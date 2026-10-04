/**
 * HTTP REST Server and Web Studio static host for StatusPulse.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MonitorEngine, checkEndpoint, checkSslCert, sendWebhookAlert } = require('../core');

const UI_DIR = path.join(__dirname, '../ui');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isPathSafe(baseDir, targetPath) {
  const resolved = path.resolve(targetPath);
  return resolved === baseDir || resolved.startsWith(baseDir + path.sep);
}

function handleStaticFile(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.join(UI_DIR, reqPath);

  if (!isPathSafe(UI_DIR, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Directory traversal blocked');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) { // 1MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function createServer(engineOptions = {}) {
  const engine = new MonitorEngine(engineOptions);
  engine.startPeriodicMonitoring();

  const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlPath = req.url.split('?')[0];

    // API Routes
    if (urlPath === '/api/status' && req.method === 'GET') {
      const summary = engine.getDashboardSummary();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        targetsCount: summary.length,
        summary
      }));
      return;
    }

    if (urlPath === '/api/check' && req.method === 'POST') {
      try {
        const { targetUrl } = await parseJsonBody(req);
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'targetUrl is required' }));
          return;
        }

        const check = await checkEndpoint(targetUrl);
        let ssl = null;
        if (check.protocol === 'https:') {
          ssl = await checkSslCert(check.hostname, check.port);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ check, ssl }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (urlPath === '/api/targets' && req.method === 'POST') {
      try {
        const { name, url, webhookUrl } = await parseJsonBody(req);
        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target URL is required' }));
          return;
        }

        const added = engine.addTarget({ name, url, webhookUrl });
        // Run instant check
        await engine.checkTarget(added);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(added));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (urlPath.startsWith('/api/targets/') && req.method === 'DELETE') {
      const targetId = urlPath.replace('/api/targets/', '');
      engine.removeTarget(targetId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, removedId: targetId }));
      return;
    }

    if (urlPath === '/api/test-webhook' && req.method === 'POST') {
      try {
        const { webhookUrl } = await parseJsonBody(req);
        if (!webhookUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'webhookUrl is required' }));
          return;
        }

        const result = await sendWebhookAlert(webhookUrl, {
          url: 'https://statuspulse.example.com',
          hostname: 'statuspulse.example.com',
          isUp: true,
          statusCode: 200,
          latencyMs: 42,
          sslDays: 120,
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (urlPath === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', name: 'status-pulse', version: '1.0.0' }));
      return;
    }

    // Static Web Studio
    if (req.method === 'GET') {
      handleStaticFile(req, res);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  });

  return { server, engine };
}

function startServer(port = 3015) {
  const { server } = createServer();
  server.listen(port, () => {
    console.log(`\n📡 StatusPulse Web Studio running at: http://localhost:${port}`);
    console.log(`Press Ctrl+C to stop.\n`);
  });
  return server;
}

module.exports = {
  createServer,
  startServer,
  isPathSafe
};
