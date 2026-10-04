document.addEventListener('DOMContentLoaded', () => {
  const inspectForm = document.getElementById('inspectForm');
  const inspectUrl = document.getElementById('inspectUrl');
  const inspectResult = document.getElementById('inspectResult');
  const targetsGrid = document.getElementById('targetsGrid');

  const addModal = document.getElementById('addModal');
  const showAddModalBtn = document.getElementById('showAddModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const addTargetForm = document.getElementById('addTargetForm');

  // Load Status Summary
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      renderTargets(data.summary || []);
    } catch (err) {
      targetsGrid.innerHTML = `<div class="text-error">Error connecting to server: ${err.message}</div>`;
    }
  }

  function renderTargets(summary) {
    if (summary.length === 0) {
      targetsGrid.innerHTML = '<div class="text-muted">No monitored endpoints configured. Add one to start monitoring!</div>';
      return;
    }

    targetsGrid.innerHTML = '';
    summary.forEach(item => {
      const { target, latest, uptimePercentage, avgLatencyMs } = item;
      const isUp = latest ? latest.isUp : true;

      const card = document.createElement('div');
      card.className = 'target-card';

      const statusBadge = isUp
        ? '<span class="badge badge-success">🟢 ONLINE</span>'
        : '<span class="badge badge-danger">🚨 OFFLINE</span>';

      let sslInfo = '<span class="text-muted">HTTP</span>';
      if (latest && latest.ssl) {
        const days = latest.ssl.daysRemaining;
        const colorClass = days <= 30 ? 'text-yellow' : 'text-green';
        sslInfo = `<span class="${colorClass}">🔒 ${days}d remaining</span>`;
      }

      card.innerHTML = `
        <div class="target-header">
          <div>
            <div class="target-title">${escapeHtml(target.name)}</div>
            <div class="target-url">${escapeHtml(target.url)}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="target-stats">
          <div class="stat-item">
            <span class="stat-label">Uptime</span>
            <span class="stat-val">${uptimePercentage}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Latency</span>
            <span class="stat-val">${avgLatencyMs} ms</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">SSL Expiry</span>
            <span class="stat-val">${sslInfo}</span>
          </div>
        </div>
        <button data-id="${target.id}" class="btn btn-danger delete-btn" style="align-self: flex-end; padding: 4px 8px; font-size: 11px;">Remove</button>
      `;

      targetsGrid.appendChild(card);
    });

    // Attach delete handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Are you sure you want to remove this monitored target?')) {
          await fetch(`/api/targets/${id}`, { method: 'DELETE' });
          fetchStatus();
        }
      });
    });
  }

  // Instant Inspect Form
  inspectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = inspectUrl.value.trim();
    inspectResult.classList.remove('hidden');
    inspectResult.innerHTML = 'Inspecting target...';

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inspection failed');

      const { check, ssl } = data;
      inspectResult.innerHTML = `
        <div><strong>Status:</strong> ${check.isUp ? '🟢 ONLINE (200 OK)' : '🚨 OFFLINE'}</div>
        <div><strong>Latency:</strong> ${check.latencyMs} ms</div>
        <div><strong>HTTP Code:</strong> ${check.statusCode || 'N/A'}</div>
        ${ssl ? `<div><strong>SSL Certificate:</strong> ${ssl.valid ? `Valid (${ssl.daysRemaining} days remaining)` : 'Invalid/Expired'} [${ssl.issuer}]</div>` : ''}
      `;
    } catch (err) {
      inspectResult.innerHTML = `<span style="color: var(--accent-red)">Error: ${err.message}</span>`;
    }
  });

  // Modal handlers
  showAddModalBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => addModal.classList.add('hidden'));

  addTargetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('targetName').value.trim();
    const url = document.getElementById('targetUrl').value.trim();
    const webhookUrl = document.getElementById('webhookUrl').value.trim() || null;

    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, webhookUrl })
      });
      if (!res.ok) throw new Error('Failed to add target');
      addModal.classList.add('hidden');
      addTargetForm.reset();
      fetchStatus();
    } catch (err) {
      alert(err.message);
    }
  });

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Initial fetch and poll every 10s
  fetchStatus();
  setInterval(fetchStatus, 10000);
});
