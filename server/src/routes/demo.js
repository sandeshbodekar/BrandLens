import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { Workspace } from '../models/Workspace.js';
import { reseedWorkspace } from '../seed/seed.js';

const router = Router();
const running = new Set(); // workspaces with a reset in progress

// POST /api/demo/reset (admin): wipe the workspace's data and reseed it (SRS 7.7).
// Users are kept, so the admin who clicked reset stays logged in.
router.post('/reset', auth, requireRole('admin'), async (req, res, next) => {
  const key = String(req.workspaceId);
  // Two overlapping resets could interleave deletes and inserts, so refuse the second.
  if (running.has(key)) return res.status(409).json({ message: 'A reset is already running' });
  running.add(key);
  try {
    const workspace = await Workspace.findById(req.workspaceId);
    const counts = await reseedWorkspace(workspace);
    res.json({ ok: true, ...counts });
  } catch (err) {
    next(err);
  } finally {
    running.delete(key);
  }
});

export default router;
