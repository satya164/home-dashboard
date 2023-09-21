async function fetchSystemInfo() {
  const system = await fetch('/api/system-info').then((res) => res.json());

  if (system.cpu) {
    document.getElementById('cpu').textContent = `${system.cpu.toFixed(2)}%`;
  }

  if (system.ram) {
    document.getElementById('ram').textContent = `${system.ram.toFixed(2)}%`;
  }

  if (system.storage) {
    document.getElementById(
      'storage'
    ).textContent = `${system.storage.used.toFixed(
      2
    )} GB / ${system.storage.total.toFixed(2)} GB`;
  }

  document.getElementById('system-info').dataset.visible = 'true';
}

async function checkStatus() {
  const status = await fetch('/api/status').then((res) => res.json());

  status.forEach((item) => {
    const el = document.querySelector(`[title="${item.name}"] .app-status`);

    el.dataset.status = item.status;
  });
}

setInterval(() => {
  fetchSystemInfo();
  checkStatus();
}, 1000 * 60);

fetchSystemInfo();
checkStatus();
