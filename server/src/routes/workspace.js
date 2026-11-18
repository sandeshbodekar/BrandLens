import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { Workspace } from '../models/Workspace.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const settingsSchema = z.object({ aiEnabled: z.boolean() });

// PATCH /api/workspace {aiEnabled} (admin) -> the updated workspace (SRS 7.7)
// aiEnabled false = rules-only mode: the review pipeline skips the LLM step.
router.patch('/', auth, requireRole('admin'), validate(settingsSchema), async (req, res, next) => {
  try {
    // The workspace id comes from the token, never from the request.
    const workspace = await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { aiEnabled: req.body.aiEnabled } },
      { new: true }
    );
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    await logAudit({
      workspaceId: workspace._id,
      actorId: req.user._id,
      action: 'ai_mode_changed',
      entity: 'Workspace',
      entityId: workspace._id,
      meta: { aiEnabled: workspace.aiEnabled },
    });
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

export default router;
