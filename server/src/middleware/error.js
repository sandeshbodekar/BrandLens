// Central error handling (SRS 10). Two pieces, registered LAST in app.js.

// Any /api path that no route matched: JSON, not Express's HTML page.
export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Turns every error that reaches next(err) into { message }, the shape the client reads.
// Known client mistakes get a 4xx and a clear message. Everything else is a 500 with a
// generic message: details go to the server log only, never to the browser.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // too late to change the response; let Express close it

  let status = null;
  let message = null;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'The request body is too large';
  } else if (err.name === 'CastError') {
    status = 400; // e.g. a malformed id or value that Mongoose cannot convert
    message = 'Invalid id or value';
  } else if (err.name === 'ValidationError') {
    status = 400; // Mongoose schema validation
    message = 'Invalid data';
  } else if (err.code === 11000) {
    status = 409; // duplicate key
    message = 'That item already exists';
  }

  if (status === null) {
    console.error(`[error] ${req.method} ${req.originalUrl}: ${err?.stack || err?.message || err}`);
    status = 500;
    message = 'Something went wrong on the server. Please try again.';
  }
  res.status(status).json({ message });
}
