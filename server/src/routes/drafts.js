import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { Draft, CONTENT_TYPES, DRAFT_STATUSES } from '../models/Draft.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { Finding } from '../models/Finding.js';
import { Workspace } from '../models/Workspace.js';
import { runReview } from '../services/reviewPipeline.js';

const router = Router();
router.use(auth);

const REVIEWER_STATUSES = ['submitted', 'approved', 'changes_requested'];
const REVIEWABLE_STATUSES = ['draft', 'checked']; // see the review route below
const reviewsRunning = new Set(); // draft ids with a review in progress

// SRS 7.3 visibility: creators see their own drafts, reviewers see drafts that
// have been submitted, admins see everything. Always inside the user's workspace.
function visibleTo(user, workspaceId) {
  const filter = { workspaceId };
  if (user.role === 'creator') filter.createdBy = user._id;
  if (user.role === 'reviewer') filter.status = { $in: REVIEWER_STATUSES };
  return filter;
}

// Loads a draft the current user is allowed to see, or answers 400/404 itself.
// A draft hidden from this user gets 404 (not 403), so its existence is not revealed.
async function loadVisibleDraft(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Invalid id' });
    return null;
  }
  const draft = await Draft.findOne({ _id: req.params.id, ...visibleTo(req.user, req.workspaceId) });
  if (!draft) {
    res.status(404).json({ message: 'Draft not found' });
    return null;
  }
  return draft;
}

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
router.get('/:id', async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    const [current, findings, versions] = await Promise.all([
      DraftVersion.findOne({ draftId: draft._id, version: draft.currentVersion }),
      Finding.find({ draftId: draft._id, version: draft.currentVersion }).sort({ start: 1, _id: 1 }),
      DraftVersion.find({ draftId: draft._id }, { text: 0 }).sort({ version: 1 }),
    ]);

    res.json({
      draft,
      text: current ? current.text : '',
      findings,
      comments: [], // Comments are built in Phase 6; the key is here so the response shape is final
      versions,
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
    res.json(await runReview({ draft, workspace }));
  } catch (err) {
    next(err);
  } finally {
    if (lockKey) reviewsRunning.delete(lockKey);
  }
});

export default router;
