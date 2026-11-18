import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { loadVisibleDraft, visibleTo } from '../services/draftAccess.js';
import { logAudit } from '../services/audit.js';
import { Draft, CONTENT_TYPES, DRAFT_STATUSES } from '../models/Draft.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { Finding } from '../models/Finding.js';
import { Comment } from '../models/Comment.js';
import { Review, REVIEW_DECISIONS } from '../models/Review.js';
import { Workspace } from '../models/Workspace.js';
import { runReview } from '../services/reviewPipeline.js';
import { applyFixes } from '../services/applyFixes.js';

const router = Router();
router.use(auth);

const REVIEWABLE_STATUSES = ['draft', 'checked']; // see the review route below
// A draft can get a new version while it is being worked on. Submitted drafts wait
// for the reviewer, approved drafts are locked (SRS 6).
const EDITABLE_STATUSES = ['draft', 'checked', 'changes_requested'];
const MAX_TEXT = 10000; // SRS 7.3
const reviewsRunning = new Set(); // draft ids with a review in progress

const CHANGED_MESSAGE = 'This draft was changed in another tab. Reload the page and try again.';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  contentType: z.enum(CONTENT_TYPES),
  text: z
    .string()
    .max(10000) // SRS 7.3 text limit
    .refine((t) => t.trim().length > 0, 'text must not be empty')
    // Store "\n" only. Highlight offsets must mean the same thing in the database
    // and in the browser textarea, which both use "\n".
    .transform((t) => t.replace(/\r\n?/g, '\n')),
});

// POST /api/drafts -> creates the draft and version 1 (status "draft")
router.post('/', requireRole('creator', 'admin'), validate(createSchema), async (req, res, next) => {
  try {
    const { title, contentType, text } = req.body;
    const draft = await Draft.create({
      workspaceId: req.workspaceId,
      title,
      contentType,
      createdBy: req.user._id,
      status: 'draft',
      currentVersion: 1,
    });
    try {
      await DraftVersion.create({ draftId: draft._id, version: 1, text, createdBy: req.user._id });
    } catch (err) {
      await Draft.deleteOne({ _id: draft._id }); // don't leave a draft without a version
      throw err;
    }
    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'draft_created',
      entityId: draft._id,
      meta: { contentType },
    });
    res.status(201).json({ draft, text });
  } catch (err) {
    next(err);
  }
});

// GET /api/drafts?status= -> drafts this user may see, newest activity first
router.get('/', async (req, res, next) => {
  try {
    const parsed = z.enum(DRAFT_STATUSES).optional().safeParse(req.query.status);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid status filter' });

    const visible = visibleTo(req.user, req.workspaceId);
    const filter = parsed.data ? { $and: [visible, { status: parsed.data }] } : visible;
    res.json(await Draft.find(filter).sort({ updatedAt: -1 }));
  } catch (err) {
    next(err);
  }
});

// GET /api/drafts/:id -> draft, current version text, its findings, comments, versions
// `reviews` (the reviewers' decisions and notes) is an addition so the creator can read
// the note after "changes requested".
router.get('/:id', async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    const [current, findings, versions, comments, reviews] = await Promise.all([
      DraftVersion.findOne({ draftId: draft._id, version: draft.currentVersion }),
      Finding.find({ draftId: draft._id, version: draft.currentVersion }).sort({ start: 1, _id: 1 }),
      DraftVersion.find({ draftId: draft._id }, { text: 0 }).sort({ version: 1 }),
      Comment.forDraft(draft._id),
      Review.find({ draftId: draft._id }).sort({ createdAt: 1 }).populate('reviewerId', 'name'),
    ]);

    res.json({
      draft,
      text: current ? current.text : '',
      findings,
      comments,
      versions,
      reviews,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/drafts/:id/review -> runs the pipeline on the current version (SRS 7.4)
// Creators (own drafts) and admins only. Allowed while the draft is "draft" or
// "checked": a submitted draft must not silently fall back to "checked", an
// approved one is locked, and after "changes_requested" the creator edits first.
router.post('/:id/review', requireRole('creator', 'admin'), async (req, res, next) => {
  let lockKey = null;
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    if (!REVIEWABLE_STATUSES.includes(draft.status)) {
      return res.status(409).json({ message: `A review cannot be run while the draft is "${draft.status}"` });
    }
    lockKey = String(draft._id);
    // Two overlapping runs would interleave the delete and insert of findings.
    if (reviewsRunning.has(lockKey)) {
      lockKey = null; // not ours to release
      return res.status(409).json({ message: 'A review is already running for this draft' });
    }
    reviewsRunning.add(lockKey);

    const workspace = await Workspace.findById(req.workspaceId);
    const result = await runReview({ draft, workspace });

    const count = (severity) => result.findings.filter((f) => f.severity === severity).length;
    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'review_run', // SRS 8 step 5
      entityId: draft._id,
      meta: {
        version: draft.currentVersion,
        findings: result.findings.length,
        high: count('high'),
        medium: count('medium'),
        low: count('low'),
        mode: result.mode,
        dropped: result.dropped,
      },
    });
    res.json(result);
  } catch (err) {
    next(err);
  } finally {
    if (lockKey) reviewsRunning.delete(lockKey);
  }
});

// Shared by "save new version" and "apply accepted fixes". Answers 409 itself and
// returns false when the draft may not be edited right now.
function ensureEditable(draft, res) {
  if (draft.status === 'approved') {
    res.status(409).json({ message: 'This draft is approved and read-only. It can no longer be edited.' });
    return false;
  }
  if (!EDITABLE_STATUSES.includes(draft.status)) {
    res.status(409).json({ message: 'This draft is waiting for a reviewer and cannot be edited right now.' });
    return false;
  }
  // A running review would write findings and a status for the version it started on.
  if (reviewsRunning.has(String(draft._id))) {
    res.status(409).json({ message: 'A review is running for this draft. Try again in a moment.' });
    return false;
  }
  return true;
}

// Creates version n+1 and makes it current, with status back to "draft" (SRS 6).
// Returns the new version number, or null if someone else changed the draft in the
// meantime (the unique index on (draftId, version) and the currentVersion check on
// the update both catch that), so two saves can never produce the same version.
async function saveNewVersion({ draft, text, note, userId }) {
  const next = draft.currentVersion + 1;
  try {
    await DraftVersion.create({ draftId: draft._id, version: next, text, createdBy: userId, note });
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }
  const result = await Draft.updateOne(
    { _id: draft._id, currentVersion: draft.currentVersion },
    { $set: { currentVersion: next, status: 'draft' } }
  );
  if (result.modifiedCount !== 1) {
    await DraftVersion.deleteOne({ draftId: draft._id, version: next });
    return null;
  }
  return next;
}

const textSchema = z.object({
  text: z
    .string()
    .max(MAX_TEXT)
    .refine((t) => t.trim().length > 0, 'text must not be empty')
    .transform((t) => t.replace(/\r\n?/g, '\n')),
  note: z.string().trim().max(200).optional(),
});

// PUT /api/drafts/:id/text {text, note} -> new version, status back to "draft" (SRS 7.3)
router.put('/:id/text', requireRole('creator', 'admin'), validate(textSchema), async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;
    if (!ensureEditable(draft, res)) return;

    const current = await DraftVersion.findOne({ draftId: draft._id, version: draft.currentVersion });
    if (current && current.text === req.body.text) {
      return res.status(400).json({ message: 'The text has not changed, so there is nothing to save' });
    }

    const version = await saveNewVersion({
      draft,
      text: req.body.text,
      note: req.body.note || 'Edited by hand',
      userId: req.user._id,
    });
    if (version === null) return res.status(409).json({ message: CHANGED_MESSAGE });

    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'version_saved',
      entityId: draft._id,
      meta: { version },
    });
    res.json({ draft: await Draft.findById(draft._id), version, text: req.body.text });
  } catch (err) {
    next(err);
  }
});

// GET /api/drafts/:id/versions/:n -> an older (or the current) version, read-only (SRS 7.3)
// Includes the findings that were made on that version, so the page can show them.
router.get('/:id/versions/:n', async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > draft.currentVersion) {
      return res.status(404).json({ message: 'Version not found' });
    }
    const [version, findings] = await Promise.all([
      DraftVersion.findOne({ draftId: draft._id, version: n }),
      Finding.find({ draftId: draft._id, version: n }).sort({ start: 1, _id: 1 }),
    ]);
    if (!version) return res.status(404).json({ message: 'Version not found' });

    res.json({ draft, version, text: version.text, findings });
  } catch (err) {
    next(err);
  }
});

// POST /api/drafts/:id/apply-accepted -> new version with the accepted/edited fixes (SRS 7.5)
router.post('/:id/apply-accepted', requireRole('creator', 'admin'), async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;
    if (!ensureEditable(draft, res)) return;

    const [current, findings] = await Promise.all([
      DraftVersion.findOne({ draftId: draft._id, version: draft.currentVersion }),
      Finding.find({ draftId: draft._id, version: draft.currentVersion }).lean(),
    ]);
    if (!current) return res.status(500).json({ message: 'Current version not found' });

    const result = applyFixes(current.text, findings);
    if (result.applied === 0) {
      return res.status(400).json({ message: 'There are no accepted or edited findings to apply' });
    }
    if (result.text.trim().length === 0) {
      return res.status(400).json({ message: 'Applying these fixes would leave the draft empty' });
    }
    if (result.text.length > MAX_TEXT) {
      return res.status(400).json({ message: `Applying these fixes would make the draft longer than ${MAX_TEXT} characters` });
    }

    const version = await saveNewVersion({
      draft,
      text: result.text,
      note: `Applied ${result.applied} fixes`, // SRS 7.5 wording
      userId: req.user._id,
    });
    if (version === null) return res.status(409).json({ message: CHANGED_MESSAGE });

    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'fixes_applied',
      entityId: draft._id,
      meta: { version, applied: result.applied, skipped: result.skipped },
    });
    res.json({
      draft: await Draft.findById(draft._id),
      version,
      text: result.text,
      applied: result.applied,
      skipped: result.skipped,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/drafts/:id/submit -> "checked" becomes "submitted" (SRS 6 and 7.6). Creator only.
// "checked" already proves the current version was reviewed: any new version resets the
// status to "draft". On top of that, no HIGH finding may still be pending.
router.post('/:id/submit', requireRole('creator'), async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    if (reviewsRunning.has(String(draft._id))) {
      return res.status(409).json({ message: 'A review is running for this draft. Try again in a moment.' });
    }
    if (draft.status !== 'checked') {
      return res.status(409).json({
        message:
          draft.status === 'draft'
            ? 'Run a review on the current version before submitting it.'
            : `A draft that is "${draft.status}" cannot be submitted.`,
      });
    }

    const pendingHigh = await Finding.countDocuments({
      draftId: draft._id,
      version: draft.currentVersion,
      severity: 'high',
      decision: 'pending',
    });
    if (pendingHigh > 0) {
      return res.status(409).json({
        message: `${pendingHigh} high severity ${pendingHigh === 1 ? 'finding is' : 'findings are'} still pending. Accept, edit or dismiss (with a reason) each one first.`,
      });
    }

    // The filter repeats the status and version we just checked, so two clicks or two
    // tabs cannot both succeed.
    const result = await Draft.updateOne(
      { _id: draft._id, status: 'checked', currentVersion: draft.currentVersion },
      { $set: { status: 'submitted' } }
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: CHANGED_MESSAGE });

    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'draft_submitted',
      entityId: draft._id,
      meta: { version: draft.currentVersion },
    });
    res.json({ draft: await Draft.findById(draft._id) });
  } catch (err) {
    next(err);
  }
});

const decisionSchema = z
  .object({
    decision: z.enum(REVIEW_DECISIONS),
    note: z.string().trim().max(1000).default(''),
  })
  .refine((b) => b.decision !== 'changes_requested' || b.note.length > 0, {
    message: 'A note is required when requesting changes',
    path: ['note'],
  });

// POST /api/drafts/:id/decision {decision, note} (SRS 7.6). Reviewer or admin only.
router.post('/:id/decision', requireRole('reviewer', 'admin'), validate(decisionSchema), async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    if (draft.status !== 'submitted') {
      return res.status(409).json({ message: 'Only a submitted draft can be approved or sent back' });
    }
    const { decision, note } = req.body;

    // Status first, atomically: only one decision can win if two reviewers click at once.
    const result = await Draft.updateOne(
      { _id: draft._id, status: 'submitted', currentVersion: draft.currentVersion },
      { $set: { status: decision } } // 'approved' or 'changes_requested' are also the draft statuses
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: CHANGED_MESSAGE });

    let review;
    try {
      review = await Review.create({
        draftId: draft._id,
        version: draft.currentVersion,
        reviewerId: req.user._id,
        decision,
        note,
      });
    } catch (err) {
      // Do not leave a decided draft without its Review row: put it back in the queue.
      await Draft.updateOne({ _id: draft._id }, { $set: { status: 'submitted' } });
      throw err;
    }

    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: decision === 'approved' ? 'draft_approved' : 'changes_requested',
      entityId: draft._id,
      meta: { version: draft.currentVersion, note },
    });
    res.json({ draft: await Draft.findById(draft._id), review });
  } catch (err) {
    next(err);
  }
});

export default router;
