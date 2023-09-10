async function fetchSystemInfo() {
  const system = await fetch('/api/system-info').then((res) => res.json());

  document.getElementById('cpu').textContent = `${system.cpu.toFixed(2)}%`;
  document.getElementById('ram').textContent = `${system.ram.toFixed(2)}%`;
  document.getElementById(
    'storage'
  ).textContent = `${system.storage.used.toFixed(
    2
  )} GB / ${system.storage.total.toFixed(2)} GB`;
}

async function checkStatus() {
  const status = await fetch('/api/status').then((res) => res.json());

  status.forEach((item) => {
    const el = document.querySelector(`[title="${item.name}"] .app-status`);
    const online =
      (item.status >= 200 && item.status < 300) || item.status === 401;

    el.dataset.status = online ? 'online' : 'offline';
  });
}

setInterval(fetchSystemInfo, 1000 * 60);

fetchSystemInfo();
checkStatus();
