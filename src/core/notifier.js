/**
 * Webhook Alert Dispatcher for Discord, Telegram & Custom HTTP Webhooks.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

function sendHttpRequest(targetUrl, payload) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch (err) {
      reject(new Error(`Invalid Webhook URL: ${targetUrl}`));
      return;
    }

    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const data = JSON.stringify(payload);
    const options = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'StatusPulse-AlertBot/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          resolve({ success: false, statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Webhook Timeout')));
    req.write(data);
    req.end();
  });
}

function formatDiscordAlert(event) {
  const isDown = !event.isUp;
  const isSslWarning = event.sslDays !== undefined && event.sslDays <= 30;

  let color = 5763719; // Green (0x57F287)
  let title = `🟢 Service RESTORED: ${event.url}`;

  if (isDown) {
    color = 15548997; // Red (0xED4245)
    title = `🚨 Service DOWN: ${event.url}`;
  } else if (isSslWarning) {
    color = 16705372; // Yellow (0xFEE75C)
    title = `⚠️ SSL Expiration Warning: ${event.hostname}`;
  }

  return {
    username: 'StatusPulse Monitor',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/1040/1040230.png',
    embeds: [
      {
        title,
        color,
        fields: [
          { name: 'Target URL', value: event.url || event.hostname, inline: false },
          { name: 'Status Code', value: String(event.statusCode || 'N/A'), inline: true },
          { name: 'Latency', value: `${event.latencyMs || 0} ms`, inline: true },
          { name: 'SSL Days Remaining', value: event.sslDays !== undefined ? `${event.sslDays} days` : 'N/A', inline: true },
          { name: 'Error Detail', value: event.error || 'None', inline: false }
        ],
        footer: { text: 'StatusPulse Uptime Guard' },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

function formatTelegramAlert(event, chatId) {
  const isDown = !event.isUp;
  const icon = isDown ? '🚨' : '🟢';
  const statusText = isDown ? '*DOWN*' : '*ONLINE*';

  const text = `${icon} *StatusPulse Alert*\n\n` +
    `*Target:* \`${event.url || event.hostname}\`\n` +
    `*State:* ${statusText}\n` +
    `*Status Code:* \`${event.statusCode || 'N/A'}\`\n` +
    `*Latency:* \`${event.latencyMs || 0} ms\`\n` +
    (event.sslDays !== undefined ? `*SSL Days:* \`${event.sslDays} days\`\n` : '') +
    (event.error ? `*Error:* \`${event.error}\`\n` : '') +
    `\n_Time: ${new Date().toLocaleString()}_`;

  return {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown'
  };
}

async function sendWebhookAlert(webhookUrl, event, type = 'auto', telegramChatId = null) {
  if (!webhookUrl) return { success: false, error: 'No Webhook URL provided' };

  let payload;
  const isDiscord = webhookUrl.includes('discord.com/api/webhooks');
  const isTelegram = webhookUrl.includes('api.telegram.org');

  if (type === 'discord' || (type === 'auto' && isDiscord)) {
    payload = formatDiscordAlert(event);
  } else if (type === 'telegram' || (type === 'auto' && isTelegram)) {
    payload = formatTelegramAlert(event, telegramChatId);
  } else {
    // Generic Webhook
    payload = {
      source: 'StatusPulse',
      event: event.isUp ? 'UPTIME_RESTORED' : 'UPTIME_DOWN',
      details: event,
      timestamp: new Date().toISOString()
    };
  }

  try {
    return await sendHttpRequest(webhookUrl, payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendHttpRequest,
  formatDiscordAlert,
  formatTelegramAlert,
  sendWebhookAlert
};
