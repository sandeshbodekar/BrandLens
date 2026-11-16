import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { User, ROLES } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DEMO_USERS } from '../seed/brandData.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
const demoSchema = z.object({ role: z.enum(ROLES) });

// JWT expires in 12 h (SRS 7.1). The user id is stored as the standard "sub" claim.
function signToken(user) {
  return jwt.sign(
    { role: user.role, workspaceId: String(user.workspaceId) },
    config.jwtSecret,
    { subject: String(user._id), expiresIn: '12h', algorithm: 'HS256' }
  );
}

// POST /api/auth/login {email, password} -> {token, user}
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const ok = user && (await user.checkPassword(password));
    // Same message for unknown email and wrong password, so emails can't be probed.
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/demo {role} -> {token, user}   (public, used by "Try demo" buttons)
router.post('/demo', validate(demoSchema), async (req, res, next) => {
  try {
    const demo = DEMO_USERS.find((u) => u.role === req.body.role);
    const user = await User.findOne({ email: demo.email });
    if (!user) {
      return res
        .status(404)
        .json({ message: 'Demo users are not seeded yet. Run "npm run seed" in the server folder.' });
    }
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me -> {user, workspace}
router.get('/me', auth, async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.user.workspaceId);
    res.json({ user: req.user, workspace });
  } catch (err) {
    next(err);
  }
});

export default router;
