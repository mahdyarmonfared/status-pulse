/**
 * Zero-dependency ANSI color and table renderer for StatusPulse CLI.
 */

const isTTY = process.stdout.isTTY;

const codes = {
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  cyan: [36, 39],
  white: [37, 39],
  bgRed: [41, 49],
  bgGreen: [42, 49]
};

const chalk = {};

Object.keys(codes).forEach((key) => {
  const [open, close] = codes[key];
  chalk[key] = (str) => {
    if (!isTTY && !process.env.FORCE_COLOR) return String(str);
    return `\x1b[${open}m${str}\x1b[${close}m`;
  };
});

function renderTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rows.forEach((row) => {
      const cell = String(row[i] || '').replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI for length calculation
      if (cell.length > max) max = cell.length;
    });
    return max + 2;
  });

  const renderRow = (row, isHeader = false) => {
    return row.map((cell, i) => {
      const cellStr = String(cell || '');
      const visibleLength = cellStr.replace(/\x1b\[[0-9;]*m/g, '').length;
      const pad = ' '.repeat(Math.max(0, colWidths[i] - visibleLength));
      return isHeader ? chalk.bold(cellStr + pad) : cellStr + pad;
    }).join('│ ');
  };

  const line = colWidths.map(w => '─'.repeat(w)).join('┼─');

  const lines = [
    renderRow(headers, true),
    line,
    ...rows.map(r => renderRow(r))
  ];

  return lines.join('\n');
}

module.exports = {
  chalk,
  renderTable
};
