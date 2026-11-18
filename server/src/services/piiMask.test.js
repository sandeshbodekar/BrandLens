import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPii } from './piiMask.js';

test('emails are replaced with [EMAIL], including plus-addressing and subdomains', () => {
  assert.equal(maskPii('Write to Priya.S+promo@fresh-nest.co.in today.'), 'Write to [EMAIL] today.');
  assert.equal(maskPii('a@b.com, c@d.org'), '[EMAIL], [EMAIL]');
  assert.equal(maskPii('9876543210@sms.example.com'), '[EMAIL]'); // digits inside an email are not a phone
});

test('10-digit phone numbers are replaced with [PHONE] in common formats', () => {
  const masked = maskPii('Call 9876543210 or +91 98765 43210 or 98765-43210, or +919876543210.');
  assert.equal(masked, 'Call [PHONE] or [PHONE] or [PHONE], or [PHONE].');
});

test('prices, dates, sizes, short and longer numbers are left alone; non-strings give an empty string', () => {
  const text = 'Rs 109 for 300 ml, offer ends 2026-12-31, order 12345, ref 20261118123045.';
  assert.equal(maskPii(text), text);
  assert.equal(maskPii('Nothing personal here.'), 'Nothing personal here.');
  assert.equal(maskPii(undefined), '');
});
