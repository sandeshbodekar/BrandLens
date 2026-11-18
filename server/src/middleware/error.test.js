import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler, notFound } from './error.js';

// A minimal fake of Express's res: remembers status and body.
function fakeRes() {
  return {
    headersSent: false,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
const req = { method: 'POST', originalUrl: '/api/test' };

test('known client errors become 4xx with a clear message', () => {
  const cases = [
    [{ type: 'entity.parse.failed' }, 400],
    [{ type: 'entity.too.large' }, 413],
    [{ name: 'CastError' }, 400],
    [{ name: 'ValidationError' }, 400],
    [{ code: 11000 }, 409],
  ];
  for (const [err, status] of cases) {
    const res = fakeRes();
    errorHandler(err, req, res, () => {});
    assert.equal(res.statusCode, status);
    assert.equal(typeof res.body.message, 'string');
  }
});

test('an unknown error is a generic 500 that does not leak details', () => {
  const log = console.error;
  console.error = () => {}; // keep the test output clean
  try {
    const res = fakeRes();
    errorHandler(new Error('connect ECONNREFUSED mongodb+srv://user:secret@host'), req, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secret'));
  } finally {
    console.error = log;
  }
});

test('notFound answers 404 JSON, and an already-sent response is passed on', () => {
  const res = fakeRes();
  notFound(req, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: 'Not found' });

  const sent = fakeRes();
  sent.headersSent = true;
  let forwarded = null;
  errorHandler(new Error('late'), req, sent, (e) => (forwarded = e));
  assert.equal(forwarded.message, 'late');
  assert.equal(sent.statusCode, null);
});
