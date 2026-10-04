const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSslCert } = require('../src/core/ssl');

test('checkSslCert handles unassigned port or error gracefully', async () => {
  const result = await checkSslCert('127.0.0.1', 65530, 500);
  assert.equal(result.valid, false);
  assert.equal(result.daysRemaining, 0);
  assert.ok(result.error !== null);
});
