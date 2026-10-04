/**
 * HTTP/HTTPS Health Checker for StatusPulse.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function checkEndpoint(targetUrl, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let urlObj;
    try {
      urlObj = new URL(targetUrl.startsWith('http://') || targetUrl.startsWith('https://') ? targetUrl : `https://${targetUrl}`);
    } catch (err) {
      resolve({
        url: targetUrl,
        isUp: false,
        statusCode: 0,
        latencyMs: 0,
        error: 'Invalid URL format',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'GET',
      headers: {
        'User-Agent': 'StatusPulse/1.0.0 Uptime Monitor'
      }
    };

    const startTime = process.hrtime.bigint();

    const req = client.request(reqOptions, (res) => {
      let bytesReceived = 0;
      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
      });

      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const latencyMs = Number(endTime - startTime) / 1e6;
        const isUp = res.statusCode >= 200 && res.statusCode < 400;

        resolve({
          url: urlObj.href,
          hostname: urlObj.hostname,
          port: reqOptions.port,
          protocol: urlObj.protocol,
          isUp,
          statusCode: res.statusCode,
          latencyMs: parseFloat(latencyMs.toFixed(2)),
          bytesReceived,
          error: null,
          timestamp: new Date().toISOString()
        });
      });
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1e6;
      resolve({
        url: urlObj.href,
        hostname: urlObj.hostname,
        port: reqOptions.port,
        protocol: urlObj.protocol,
        isUp: false,
        statusCode: 0,
        latencyMs: parseFloat(latencyMs.toFixed(2)),
        bytesReceived: 0,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Connection Timeout'));
    });

    req.end();
  });
}

module.exports = {
  checkEndpoint
};
