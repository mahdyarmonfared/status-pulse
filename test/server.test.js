const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer, isPathSafe } = require('../src/server/server');

test('isPathSafe correctly detects directory traversal attempts', () => {
  const base = '/var/www/ui';
  assert.equal(isPathSafe(base, '/var/www/ui/index.html'), true);
  assert.equal(isPathSafe(base, '/var/www/ui/style.css'), true);
  assert.equal(isPathSafe(base, '/var/www/ui/../etc/passwd'), false);
  assert.equal(isPathSafe(base, '/etc/passwd'), false);
});

test('HTTP server /api/health endpoint returns 200 OK', async () => {
  const { server, engine } = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ statusCode: response.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.name, 'status-pulse');
  } finally {
    engine.stopMonitoring();
    await new Promise(resolve => server.close(resolve));
  }
});
