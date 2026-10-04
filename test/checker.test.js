const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { checkEndpoint } = require('../src/core/checker');

test('checkEndpoint returns ONLINE status for 200 OK HTTP target', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const targetUrl = `http://127.0.0.1:${port}/health`;

  try {
    const result = await checkEndpoint(targetUrl);
    assert.equal(result.isUp, true);
    assert.equal(result.statusCode, 200);
    assert.ok(result.latencyMs >= 0);
    assert.equal(result.error, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('checkEndpoint handles invalid URL gracefully', async () => {
  const result = await checkEndpoint('invalid-url-schema-xyz');
  assert.equal(result.isUp, false);
});
