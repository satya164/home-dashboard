async function fetchSystemInfo() {
  const system = await fetch('/api/system-info').then((res) => res.json());

  const cpu = document.getElementById('cpu');
  const ram = document.getElementById('ram');
  const storage = document.getElementById('storage');

  if (system.cpu) {
    cpu.textContent = `${system.cpu.toFixed(2)}%`;
  }

  if (system.cpu >= 70) {
    cpu.classList.add('warning');
  } else if (system.cpu >= 90) {
    cpu.classList.add('danger');
  } else {
    cpu.classList.remove('warning', 'danger');
  }

  if (system.ram) {
    ram.textContent = `${system.ram.toFixed(2)}%`;
  }

  if (system.ram >= 70) {
    ram.classList.add('warning');
  } else if (system.ram >= 90) {
    ram.classList.add('danger');
  } else {
    ram.classList.remove('warning', 'danger');
  }

  if (system.storage) {
    storage.textContent = `${system.storage.used.toFixed(
      2
    )} GB / ${system.storage.total.toFixed(2)} GB`;
  }

  if (system.storage.used >= system.storage.total * 0.7) {
    storage.classList.add('warning');
  } else if (system.storage.used >= system.storage.total * 0.9) {
    storage.classList.add('danger');
  } else {
    storage.classList.remove('warning', 'danger');
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
