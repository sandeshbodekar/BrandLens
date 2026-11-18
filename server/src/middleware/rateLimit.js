import rateLimit from 'express-rate-limit';

// SRS 10: express-rate-limit, "stricter on login and review".
// All limiters answer 429 with { message }, the same shape as every other error, so the
// client shows it like any other message.
const WINDOW = 15 * 60 * 1000; // 15 minutes

const make = ({ limit, message, ...rest }) =>
  rateLimit({
    windowMs: WINDOW,
    limit,
    standardHeaders: 'draft-7', // sends RateLimit-* headers so the limit is visible
    legacyHeaders: false,
    message: { message },
    ...rest,
  });

// Every /api request except /api/health, per IP. The SRS says "for example 100 req/15 min";
// a single review page load already makes about 5 calls, so 100 would lock out a judge
// who is clicking around. 300 still stops scripts.
export const apiLimiter = make({
  limit: 300,
  message: 'Too many requests. Please wait a few minutes and try again.',
});

// Password login: only FAILED attempts count, so the real user is never blocked
// by their own successful logins.
export const loginLimiter = make({
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Please wait 15 minutes and try again.',
});

// "Try demo" buttons are public and must work many times for judges, so this is generous.
export const demoLoginLimiter = make({
  limit: 60,
  message: 'Too many demo logins. Please wait a few minutes and try again.',
});

// The two limiters below run AFTER auth, so they count per user, not per IP:
// judges often share one office or campus IP address.
const perUser = (req) => String(req.user._id);

// A review can call the paid AI service, so it is limited more tightly.
export const reviewLimiter = make({
  limit: 30,
  keyGenerator: perUser,
  message: 'You have run many reviews in a short time. Please wait a few minutes and try again.',
});

// Reset wipes and reseeds the workspace.
export const resetLimiter = make({
  limit: 10,
  keyGenerator: perUser,
  message: 'Too many resets. Please wait a few minutes and try again.',
});
