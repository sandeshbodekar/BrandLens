import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loadVisibleDraft } from '../services/draftAccess.js';
import { logAudit } from '../services/audit.js';
import { Comment } from '../models/Comment.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { AuditLog } from '../models/AuditLog.js';

// Mounted at /api/drafts (see app.js). `auth` is applied per route, not with router.use,
// so requests for other /api/drafts routes are not authenticated twice.
const router = Router();

const anchor = z.number().int().min(0).nullable().optional();
const commentSchema = z
  .object({ text: z.string().trim().min(1).max(2000), anchorStart: anchor, anchorEnd: anchor })
  .refine((b) => (b.anchorStart == null) === (b.anchorEnd == null), {
    message: 'anchorStart and anchorEnd must be sent together',
    path: ['anchorEnd'],
  })
  .refine((b) => b.anchorStart == null || b.anchorEnd > b.anchorStart, {
    message: 'anchorEnd must be greater than anchorStart',
    path: ['anchorEnd'],
  });

// GET /api/drafts/:id/comments (SRS 7.6)
router.get('/:id/comments', auth, async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;
    res.json(await Comment.forDraft(draft._id));
  } catch (err) {
    next(err);
  }
});

// POST /api/drafts/:id/comments {text, anchorStart?, anchorEnd?}
// Anyone who can see the draft may comment, including on an approved (read-only) draft:
// a comment does not change the draft.
router.post('/:id/comments', auth, validate(commentSchema), async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;

    const { text, anchorStart = null, anchorEnd = null } = req.body;
    if (anchorStart !== null) {
      const current = await DraftVersion.findOne({ draftId: draft._id, version: draft.currentVersion });
      if (!current || anchorEnd > current.text.length) {
        return res.status(400).json({ message: 'The comment anchor is outside the draft text' });
      }
    }

    const comment = await Comment.create({
      draftId: draft._id,
      version: draft.currentVersion,
      authorId: req.user._id,
      text,
      anchorStart,
      anchorEnd,
    });
    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'comment_added',
      entityId: draft._id,
      meta: { commentId: comment._id, version: draft.currentVersion },
    });
    res.status(201).json(await Comment.findById(comment._id).populate('authorId', 'name role'));
  } catch (err) {
    next(err);
  }
});

// GET /api/drafts/:id/audit -> the audit trail of this draft, newest first (SRS 7.6)
router.get('/:id/audit', auth, async (req, res, next) => {
  try {
    const draft = await loadVisibleDraft(req, res);
    if (!draft) return;
    const rows = await AuditLog.find({ workspaceId: req.workspaceId, entity: 'Draft', entityId: draft._id })
      .sort({ createdAt: -1, _id: -1 })
      .populate('actorId', 'name role');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
