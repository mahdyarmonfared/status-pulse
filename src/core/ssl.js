/**
 * TLS/SSL Certificate Inspector for StatusPulse.
 * Uses native tls module to inspect certificate validity and expiration.
 */

const tls = require('tls');
const net = require('net');

function checkSslCert(hostname, port = 443, timeoutMs = 10000) {
  return new Promise((resolve) => {
    // Strip protocol if present
    const cleanHost = hostname.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

    const connectOpts = {
      host: cleanHost,
      port: parseInt(port, 10) || 443,
      rejectUnauthorized: false // Retrieve cert even if self-signed to report details
    };

    if (!net.isIP(cleanHost)) {
      connectOpts.servername = cleanHost;
    }

    const socket = tls.connect(connectOpts, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        socket.destroy();

        if (!cert || Object.keys(cert).length === 0) {
          resolve({
            hostname: cleanHost,
            valid: false,
            error: 'No SSL certificate served',
            daysRemaining: 0
          });
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const issuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown CA') : 'Unknown';
        const subject = cert.subject ? (cert.subject.CN || cleanHost) : cleanHost;

        resolve({
          hostname: cleanHost,
          port: parseInt(port, 10) || 443,
          valid: daysRemaining > 0,
          daysRemaining,
          isExpiringSoon: daysRemaining <= 30,
          isExpired: daysRemaining <= 0,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          subject,
          issuer,
          fingerprint: cert.fingerprint || null,
          serialNumber: cert.serialNumber || null,
          error: null
        });
      } catch (err) {
        socket.destroy();
        resolve({
          hostname: cleanHost,
          valid: false,
          error: err.message,
          daysRemaining: 0
        });
      }
    });

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({
        hostname: cleanHost,
        valid: false,
        error: 'TLS Connection Timeout',
        daysRemaining: 0
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        hostname: cleanHost,
        valid: false,
        error: err.message,
        daysRemaining: 0
      });
    });
  });
}

module.exports = {
  checkSslCert
};
