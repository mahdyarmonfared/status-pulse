/**
 * Zero-dependency ASCII chart & status card renderer for StatusPulse.
 */

const { chalk } = require('./ansi');

function renderSparkline(latencies = [], maxBars = 15) {
  if (latencies.length === 0) return chalk.dim('no data');
  const values = latencies.slice(-maxBars);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const ticks = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  return values.map(val => {
    const idx = Math.min(ticks.length - 1, Math.floor(((val - min) / range) * (ticks.length - 1)));
    return ticks[idx];
  }).join('');
}

function renderSslCard(ssl) {
  if (!ssl) return chalk.dim('No SSL (HTTP)');
  if (!ssl.valid) return chalk.red(`✖ Invalid SSL (${ssl.error || 'Expired'})`);

  let color = chalk.green;
  let statusText = `${ssl.daysRemaining} days remaining`;

  if (ssl.isExpiringSoon) {
    color = chalk.yellow;
    statusText = `⚠️ EXPIRING SOON (${ssl.daysRemaining} days remaining)`;
  }
  if (ssl.isExpired) {
    color = chalk.red;
    statusText = `🚨 EXPIRED (${Math.abs(ssl.daysRemaining)} days ago)`;
  }

  return `${color(statusText)} ${chalk.dim(`[${ssl.issuer}]`)}`;
}

module.exports = {
  renderSparkline,
  renderSslCard
};
