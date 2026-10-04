/**
 * Core Uptime Monitor & Target State Manager for StatusPulse.
 */

const fs = require('fs');
const path = require('path');
const { checkEndpoint } = require('./checker');
const { checkSslCert } = require('./ssl');
const { sendWebhookAlert } = require('./notifier');

class MonitorEngine {
  constructor(options = {}) {
    this.targets = options.targets || [
      { id: '1', name: 'Google Search', url: 'https://www.google.com', webhookUrl: null },
      { id: '2', name: 'GitHub API', url: 'https://api.github.com', webhookUrl: null },
      { id: '3', name: 'HTTPBin Test', url: 'https://httpbin.org/status/200', webhookUrl: null }
    ];
    this.intervalMs = options.intervalMs || 60000; // 1 minute
    this.history = {}; // targetId -> Array of checks
    this.lastStates = {}; // targetId -> { isUp, sslDays }
    this.timer = null;
    this.configFile = options.configFile || path.join(process.cwd(), 'status-pulse-config.json');

    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.targets)) {
          this.targets = parsed.targets;
        }
        if (parsed.intervalMs) {
          this.intervalMs = parsed.intervalMs;
        }
      }
    } catch (err) {
      // Use defaults if config file is invalid
    }
  }

  saveConfig() {
    try {
      const data = JSON.stringify({
        intervalMs: this.intervalMs,
        targets: this.targets
      }, null, 2);
      fs.writeFileSync(this.configFile, data, 'utf8');
    } catch (err) {
      // Ignore save error in read-only environments
    }
  }

  addTarget(target) {
    const newTarget = {
      id: String(Date.now()),
      name: target.name || target.url,
      url: target.url,
      webhookUrl: target.webhookUrl || null
    };
    this.targets.push(newTarget);
    this.saveConfig();
    return newTarget;
  }

  removeTarget(targetId) {
    this.targets = this.targets.filter(t => t.id !== targetId);
    delete this.history[targetId];
    delete this.lastStates[targetId];
    this.saveConfig();
  }

  async checkTarget(target) {
    const checkResult = await checkEndpoint(target.url);

    let sslResult = null;
    if (checkResult.protocol === 'https:') {
      sslResult = await checkSslCert(checkResult.hostname, checkResult.port);
    }

    const merged = {
      targetId: target.id,
      name: target.name,
      url: checkResult.url,
      isUp: checkResult.isUp,
      statusCode: checkResult.statusCode,
      latencyMs: checkResult.latencyMs,
      error: checkResult.error,
      timestamp: checkResult.timestamp,
      ssl: sslResult
    };

    // Store history
    if (!this.history[target.id]) {
      this.history[target.id] = [];
    }
    this.history[target.id].push(merged);
    if (this.history[target.id].length > 50) {
      this.history[target.id].shift();
    }

    // Alert evaluation
    const prevState = this.lastStates[target.id];
    if (prevState !== undefined) {
      if (prevState.isUp !== merged.isUp) {
        // State changed!
        if (target.webhookUrl) {
          sendWebhookAlert(target.webhookUrl, {
            ...merged,
            sslDays: sslResult ? sslResult.daysRemaining : undefined
          });
        }
      }
    }

    this.lastStates[target.id] = {
      isUp: merged.isUp,
      sslDays: sslResult ? sslResult.daysRemaining : undefined
    };

    return merged;
  }

  async runAllChecks() {
    const results = await Promise.all(this.targets.map(target => this.checkTarget(target)));
    return results;
  }

  startPeriodicMonitoring(callback) {
    if (this.timer) clearInterval(this.timer);

    // Initial check
    this.runAllChecks().then(results => {
      if (callback) callback(results);
    });

    this.timer = setInterval(async () => {
      const results = await this.runAllChecks();
      if (callback) callback(results);
    }, this.intervalMs);
  }

  stopMonitoring() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getDashboardSummary() {
    const summary = this.targets.map(target => {
      const targetHistory = this.history[target.id] || [];
      const latest = targetHistory[targetHistory.length - 1] || null;

      const totalChecks = targetHistory.length;
      const upChecks = targetHistory.filter(h => h.isUp).length;
      const uptimePercentage = totalChecks > 0 ? parseFloat(((upChecks / totalChecks) * 100).toFixed(2)) : 100;

      const latencies = targetHistory.map(h => h.latencyMs);
      const avgLatencyMs = latencies.length > 0 ? parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)) : 0;

      return {
        target,
        latest,
        uptimePercentage,
        avgLatencyMs,
        historyCount: totalChecks
      };
    });

    return summary;
  }
}

module.exports = {
  MonitorEngine
};
