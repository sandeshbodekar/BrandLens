import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { Draft } from '../models/Draft.js';
import { Finding } from '../models/Finding.js';

const router = Router();
router.use(auth);

// Decisions are only possible while the draft is still being worked on. A submitted
// draft is waiting for a reviewer, and an approved one is locked.
const DECIDABLE_STATUSES = ['draft', 'checked'];

const decisionSchema = z
  .object({
    decision: z.enum(['accepted', 'edited', 'dismissed']),
    // Normalise line endings, like draft text, so applied fixes keep "\n" only.
    editedSuggestion: z
      .string()
      .max(2000)
      .transform((s) => s.replace(/\r\n?/g, '\n'))
      .optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((b) => b.decision !== 'edited' || b.editedSuggestion !== undefined, {
    message: 'editedSuggestion is required when decision is "edited"',
    path: ['editedSuggestion'],
  });

// PATCH /api/findings/:id {decision, editedSuggestion?, reason?}  (SRS 7.5)
// Creators decide on findings of their own drafts, admins on any draft of the workspace.
router.patch('/:id', requireRole('creator', 'admin'), validate(decisionSchema), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });

    const finding = await Finding.findById(req.params.id);
    // A Finding has no workspaceId (SRS 5), so isolation comes from loading its draft
    // inside the user's workspace. Anything else is "not found", never "forbidden".
    const draftFilter = finding && { _id: finding.draftId, workspaceId: req.workspaceId };
    if (draftFilter && req.user.role === 'creator') draftFilter.createdBy = req.user._id;
    const draft = finding ? await Draft.findOne(draftFilter) : null;
    if (!finding || !draft) return res.status(404).json({ message: 'Finding not found' });

    if (finding.version !== draft.currentVersion) {
      return res.status(409).json({ message: 'This finding belongs to an older version and can no longer be changed' });
    }
    if (!DECIDABLE_STATUSES.includes(draft.status)) {
      return res.status(409).json({ message: `Findings cannot be changed while the draft is "${draft.status}"` });
    }

    const { decision, editedSuggestion, reason } = req.body;
    // SRS 9 and 6: dismissing a high-severity finding needs a reason.
    if (decision === 'dismissed' && finding.severity === 'high' && !reason) {
      return res.status(400).json({ message: 'A reason is required to dismiss a high severity finding' });
    }

    finding.decision = decision;
    finding.editedSuggestion = decision === 'edited' ? editedSuggestion : null;
    finding.decisionReason = decision === 'dismissed' && reason ? reason : null;
    finding.decidedBy = req.user._id;
    finding.decidedAt = new Date();
    await finding.save();

    res.json(finding);
  } catch (err) {
    next(err);
  }
});

export default router;
