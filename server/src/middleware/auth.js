import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

// Requires "Authorization: Bearer <token>". On success sets:
//   req.user        the current User document (loaded fresh from the DB)
//   req.workspaceId the user's workspace, used to scope every query (SRS 3)
export async function auth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let payload;
    try {
      // Pin the algorithm so a token cannot choose a weaker one (e.g. "none").
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Loading the user on each request means role changes or deleted users
    // take effect immediately, not when the token expires.
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Invalid or expired token' });

    req.user = user;
    req.workspaceId = user.workspaceId;
    next();
  } catch (err) {
    next(err);
  }
}
