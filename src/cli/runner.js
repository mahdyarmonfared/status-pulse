/**
 * CLI Command runner for StatusPulse.
 */

const { checkEndpoint, checkSslCert, MonitorEngine } = require('../core');
const { chalk, renderTable } = require('./ansi');
const { renderSslCard } = require('./chart');

function parseArgs(args) {
  const parsed = {
    command: null,
    targetUrl: null,
    options: {
      interval: 60,
      port: 3015,
      json: false,
      help: false,
      version: false
    }
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.options.version = true;
    } else if (arg === '--json') {
      parsed.options.json = true;
    } else if ((arg === '-i' || arg === '--interval') && args[i + 1]) {
      parsed.options.interval = parseInt(args[++i], 10);
    } else if ((arg === '-p' || arg === '--port') && args[i + 1]) {
      parsed.options.port = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    const cmd = positional[0].toLowerCase();
    if (['check', 'monitor', 'ui', 'studio', 'help'].includes(cmd)) {
      parsed.command = cmd;
      if (positional[1]) parsed.targetUrl = positional[1];
    } else {
      parsed.command = 'check';
      parsed.targetUrl = positional[0];
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
${chalk.bold(chalk.cyan('📡 StatusPulse Uptime & SSL Monitor'))} ${chalk.dim('v1.0.0')}
${chalk.dim('Zero-dependency server uptime monitoring, SSL cert expiration engine & Web Studio.')}

${chalk.bold('USAGE:')}
  ${chalk.green('status-pulse')} ${chalk.yellow('<command>')} ${chalk.cyan('[options]')}

${chalk.bold('COMMANDS:')}
  ${chalk.yellow('check <url>')}        Perform one-shot uptime & SSL inspection on target URL
  ${chalk.yellow('monitor')}            Run periodic background monitoring daemon
  ${chalk.yellow('ui, studio')}         Launch interactive Web Studio dashboard on localhost:3015
  ${chalk.yellow('help')}               Display this help guide

${chalk.bold('OPTIONS:')}
  ${chalk.cyan('-i, --interval <sec>')}    Monitoring check interval in seconds (default: 60)
  ${chalk.cyan('-p, --port <number>')}     Port for Web Studio dashboard (default: 3015)
  ${chalk.cyan('--json')}                  Output raw JSON status report
  ${chalk.cyan('-h, --help')}              Display help guide
  ${chalk.cyan('-v, --version')}           Display version

${chalk.bold('EXAMPLES:')}
  $ status-pulse check https://api.github.com
  $ status-pulse monitor --interval 30
  $ status-pulse ui --port 3015
`);
}

async function runSingleCheck(targetUrl, options) {
  if (!targetUrl) {
    console.error(chalk.red('✖ Error: Target URL is required for check. Example: status-pulse check https://example.com'));
    return 1;
  }

  console.log(`\n${chalk.bold(chalk.cyan('📡 StatusPulse Inspection'))}`);
  console.log(` Target: ${chalk.bold(targetUrl)}\n`);

  const check = await checkEndpoint(targetUrl);
  let ssl = null;

  if (check.protocol === 'https:') {
    ssl = await checkSslCert(check.hostname, check.port);
  }

  if (options.json) {
    console.log(JSON.stringify({ check, ssl }, null, 2));
    return 0;
  }

  const headers = ['Property', 'Value'];
  const rows = [
    [chalk.bold('Target URL'), check.url],
    [chalk.bold('Health Status'), check.isUp ? chalk.green('🟢 ONLINE (UP)') : chalk.red('🚨 OFFLINE (DOWN)')],
    [chalk.bold('HTTP Status'), check.statusCode ? `${check.statusCode}` : chalk.dim('N/A')],
    [chalk.bold('Response Latency'), `${check.latencyMs} ms`],
    [chalk.bold('SSL Cert Expiry'), renderSslCard(ssl)],
    [chalk.bold('Timestamp'), check.timestamp]
  ];

  if (check.error) {
    rows.push([chalk.bold('Error Message'), chalk.red(check.error)]);
  }

  console.log(renderTable(headers, rows));
  console.log('');
  return 0;
}

function runMonitorDaemon(options) {
  const engine = new MonitorEngine({ intervalMs: options.interval * 1000 });
  console.log(`\n${chalk.bold(chalk.cyan('🚀 Starting StatusPulse Monitoring Daemon'))}`);
  console.log(` Check Interval: ${chalk.yellow(options.interval)} seconds`);
  console.log(` Monitored Targets: ${engine.targets.length}`);
  console.log(`${chalk.dim('Press Ctrl+C to stop.')}\n`);

  engine.startPeriodicMonitoring((results) => {
    console.log(`\n--- Check Cycle: ${new Date().toLocaleTimeString()} ---`);
    results.forEach(res => {
      const statusIcon = res.isUp ? chalk.green('🟢 UP') : chalk.red('🚨 DOWN');
      const sslStr = res.ssl ? ` (SSL: ${res.ssl.daysRemaining}d remaining)` : '';
      console.log(` ${statusIcon} [${res.latencyMs}ms] ${res.name} -> ${res.url}${sslStr}`);
    });
  });
}

function runUiServer(options) {
  const { startServer } = require('../server/server');
  startServer(options.port);
}

async function execute(args = process.argv.slice(2)) {
  const { command, targetUrl, options } = parseArgs(args);

  if (options.version) {
    const pkg = require('../../package.json');
    console.log(`status-pulse v${pkg.version}`);
    return 0;
  }

  if (options.help || command === 'help') {
    printHelp();
    return 0;
  }

  if (command === 'ui' || command === 'studio') {
    runUiServer(options);
    return 0;
  }

  if (command === 'monitor') {
    runMonitorDaemon(options);
    return 0;
  }

  return await runSingleCheck(targetUrl || command, options);
}

module.exports = {
  execute,
  parseArgs
};
