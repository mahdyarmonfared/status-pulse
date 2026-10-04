# 📡 StatusPulse

> Zero-dependency server uptime monitoring, SSL certificate expiration engine & Web Studio with Discord/Telegram webhook alert notifications.

![StatusPulse Web Studio](https://raw.githubusercontent.com/mahdyarmonfared/status-pulse/main/docs/preview.png)

## ⚡ Features

- 📡 **HTTP/HTTPS Uptime Monitoring**: Periodic health checks verifying response status codes and latency.
- 🔒 **SSL Expiration Inspection**: Native TLS certificate peer inspection calculating days remaining until SSL cert expiration.
- 🔔 **Webhook Alerts**: Instant notifications for Discord, Telegram bots, and custom HTTP POST endpoints on state changes or SSL expiry.
- 🌐 **Interactive Web Studio**: Built-in web GUI dashboard hosted on `http://localhost:3015`.
- 📊 **CLI & Background Daemon**: Inspect URLs on-demand or run as a lightweight daemon process.
- 📦 **Zero Dependencies**: 100% pure Node.js standard libraries (`http`, `https`, `tls`, `url`, `fs`, `node:test`).

---

## 🛠️ Installation

```bash
git clone https://github.com/mahdyarmonfared/status-pulse.git
cd status-pulse
npm link
```

---

## 🚀 Quick Start

### 1. Perform One-Shot Inspection via CLI

```bash
status-pulse check https://api.github.com
```

### 2. Run Periodic Monitoring Daemon

```bash
status-pulse monitor --interval 30
```

### 3. Launch Web Studio Dashboard

```bash
status-pulse ui --port 3015
```

Open `http://localhost:3015` in your browser to inspect endpoints visually and manage alert webhooks.

---

## 📖 CLI Usage

```text
USAGE:
  status-pulse <command> [options]

COMMANDS:
  check <url>        Perform one-shot uptime & SSL inspection on target URL
  monitor            Run periodic background monitoring daemon
  ui, studio         Launch interactive Web Studio dashboard on localhost:3015
  help               Display help guide

OPTIONS:
  -i, --interval <sec>    Monitoring check interval in seconds (default: 60)
  -p, --port <number>     Port for Web Studio dashboard (default: 3015)
  --json                  Output raw JSON status report
  -h, --help              Display help guide
  -v, --version           Display version
```

---

## 💻 Programmatic Usage

```javascript
const { checkEndpoint, checkSslCert, sendWebhookAlert } = require('status-pulse');

async function main() {
  const check = await checkEndpoint('https://api.github.com');
  const ssl = await checkSslCert('api.github.com');

  console.log(`Is Online: ${check.isUp}`);
  console.log(`SSL Days Remaining: ${ssl.daysRemaining}`);
}

main();
```

---

## 🧪 Testing

Run the native test suite:

```bash
npm test
```

---

## 📄 License

[MIT](LICENSE) © Mahdyar Monfared
