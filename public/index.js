async function fetchSystemInfo() {
  const system = await fetch('/api/system-info').then((res) => res.json());

  const info = [];

  if (system.cpu) {
    const label = 'CPU';
    const value = `${system.cpu.toFixed(2)}%`;
    const status =
      system.cpu >= 70 ? 'warning' : system.cpu >= 90 ? 'danger' : null;

    info.push({ label, value, status });
  }

  if (system.ram) {
    const label = 'RAM';
    const value = `${system.ram.used.toFixed(
      2
    )} GB / ${system.ram.total.toFixed(2)} GB`;
    const status =
      system.ram.used >= system.ram.total * 0.7
        ? 'warning'
        : system.ram.used >= system.ram.total * 0.9
        ? 'danger'
        : null;

    info.push({ label, value, status });
  }

  if (system.storage) {
    system.storage.forEach((it, index, self) => {
      const label = self.length > 1 ? `Disk ${index + 1}` : 'Disk';
      const value = `${it.used.toFixed(2)} GB / ${it.total.toFixed(2)} GB`;
      const status =
        it.used >= it.total * 0.7
          ? 'warning'
          : it.used >= it.total * 0.9
          ? 'danger'
          : null;

      info.push({ label, value, status });
    });
  }

  const section = document.getElementById('system-info');

  if (info.length) {
    section.innerHTML = '';

    info.forEach((it) => {
      const element = document.createElement('label');
      const label = document.createElement('span');
      const value = document.createElement('span');

      label.classList.add('label');

      label.textContent = it.label;
      value.textContent = it.value;

      if (it.status) {
        value.classList.add(it.status);
      }

      element.appendChild(label);
      element.appendChild(value);

      section.appendChild(element);
    });
  } else {
    section.innerHTML = '&nbsp;';
  }

  section.dataset.visible = 'true';
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
