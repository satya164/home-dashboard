async function fetchSystemInfo() {
  const system = await fetch('/api/system-info').then((res) => res.json());

  const info = [];

  if (typeof system.cpu === 'number') {
    const label = 'CPU';
    const value = `${system.cpu.toFixed(2)}%`;
    const status =
      system.cpu >= 90 ? 'danger' : system.cpu >= 70 ? 'warning' : null;

    info.push({ label, value, status });
  }

  if (system.ram) {
    const label = 'RAM';
    const value = `${system.ram.used.toFixed(
      2
    )} GB / ${system.ram.total.toFixed(2)} GB`;
    const status =
      system.ram.used >= system.ram.total * 0.9
        ? 'danger'
        : system.ram.used >= system.ram.total * 0.7
          ? 'warning'
          : null;

    info.push({ label, value, status });
  }

  if (system.storage) {
    system.storage.forEach((it) => {
      const label = it.mount === '/' ? 'Disk' : `Disk (${it.mount})`;
      const value = `${it.used.toFixed(2)} GB / ${it.total.toFixed(2)} GB`;
      const status =
        it.used >= it.total * 0.9
          ? 'danger'
          : it.used >= it.total * 0.7
            ? 'warning'
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

    section.dataset.visible = 'true';
  } else {
    section.innerHTML = '&nbsp;';
    section.dataset.visible = 'false';
  }
}

async function checkStatus() {
  const status = await fetch('/api/status').then((res) => res.json());

  status.forEach((item) => {
    const el = document.querySelector(`[data-id="${item.id}"] .app-status`);

    if (el) {
      el.dataset.status = item.state;
    }
  });
}

function addSearch() {
  const search = document.getElementById('search');
  const grid = document.getElementById('app-grid');

  document.addEventListener('keydown', (event) => {
    if (event.key.length === 1) {
      search.focus();
    } else {
      switch (event.key) {
        case 'Escape':
          {
            search.blur();
            search.value = '';
            search.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
        case 'Tab':
          {
            // Remove any focus styling and let the browser handle the focus
            const focused = grid.querySelector('.app-tile[data-focus="true"]');

            if (focused) {
              focused.dataset.focus = 'false';
              // Move the focus to highlighted element so browser can start from there
              focused.focus();
            }
          }
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          {
            // Prevent the default behavior of moving the cursor
            event.preventDefault();

            const results = Array.from(
              grid.querySelectorAll(
                '.app-tile:not([data-match="none"])'
              )
            );

            if (results.length) {
              const focused = results.find(
                (app) =>
                  app.dataset.focus === 'true' || app === document.activeElement
              );

              const index = results.indexOf(focused);

              if (index === -1) {
                results[0].dataset.focus = 'true';
              } else {
                // Count the number of tiles in the first row
                let numtiles = 0;

                for (let i = 0; i < results.length; i++) {
                  if (
                    results[i].getBoundingClientRect().top !==
                    results[0].getBoundingClientRect().top
                  ) {
                    break;
                  }

                  numtiles++;
                }

                const numrows = Math.ceil(results.length / numtiles);
                const currentrow = Math.floor(index / numtiles);

                let next = index;

                switch (event.key) {
                  case 'ArrowLeft':
                    if (index > 0) {
                      next = index - 1;
                    } else {
                      next = results.length - 1;
                    }

                    break;
                  case 'ArrowRight':
                    if (index < results.length - 1) {
                      next = index + 1;
                    } else {
                      next = 0;
                    }

                    break;
                  case 'ArrowUp':
                    if (numrows !== 1) {
                      // The last row may not be full
                      // So we need to adjust if we're on the first row,
                      // and cycling to the last row
                      const delta = results.length % numtiles;
                      const position = index % numtiles;

                      if (currentrow === 0) {
                        // If delta is within the current row, move to the last row
                        if (delta <= position) {
                          next = results.length - 1;
                        } else {
                          next = results.length - delta + position;
                        }
                      } else {
                        next = index - numtiles;
                      }
                    }

                    break;
                  case 'ArrowDown':
                    if (numrows !== 1) {
                      // If we're on the last row, it may not be full
                      // So we need to adjust the number of tiles when cycling to the top row
                      if (currentrow === numrows - 1) {
                        next = index % numtiles;
                      } else {
                        next = index + numtiles;

                        if (next >= results.length) {
                          next = results.length - 1;
                        }
                      }
                    }

                    break;
                }

                const item = results[next];

                if (item) {
                  focused.dataset.focus = 'false';
                  item.dataset.focus = 'true';

                  // If the previous item was focused, then move the focus to the next item
                  // Also add the focus if no element (such as search input) is focused
                  if (
                    !document.activeElement ||
                    focused === document.activeElement
                  ) {
                    item.focus();
                  }
                }
              }
            }
          }
          break;
        case 'Enter':
          {
            const focused = Array.from(grid.querySelectorAll('.app-tile')).find(
              (app) =>
                app.dataset.focus === 'true' || app === document.activeElement
            );

            if (focused) {
              // Prevent the default behavior to avoid double-clicking
              event.preventDefault();
              focused.click();
            }
          }
          break;
      }
    }
  });

  search.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    const apps = grid.querySelectorAll('.app-tile');

    apps.forEach((app) => {
      const name = app.querySelector('.app-name');

      if (query) {
        const title = app.dataset.name.toLowerCase();

        if (title === query) {
          app.dataset.match = 'exact';
        } else if (title.startsWith(query)) {
          app.dataset.match = 'start';
        } else if (title.includes(query)) {
          app.dataset.match = 'partial';
        } else {
          app.dataset.match = 'none';
        }

        // Highlight the matched text
        name.innerHTML = name.textContent.replace(
          new RegExp(
            `(${
              // Escape regex reserved characters
              query.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
            })`,
            'gi'
          ),
          '<mark>$1</mark>'
        );
      } else {
        app.dataset.match = 'unknown';
        // Remove HTML tags (e.g. <mark>)
        name.textContent = name.textContent;
      }

      app.dataset.focus = 'false';
    });

    // Sort the items based on the match if there is a query
    // Otherwise, sort based on the original index
    const sorted = Array.from(apps).sort((a, b) => {
      const aIndex = Number(a.dataset.index);
      const bIndex = Number(b.dataset.index);

      const weights = {
        exact: 3,
        start: 2,
        partial: 1,
        none: 0,
        unknown: -1,
      };

      if (a.dataset.match === b.dataset.match) {
        return aIndex - bIndex;
      }

      return weights[b.dataset.match] - weights[a.dataset.match];
    });

    // Update the grid with the sorted items
    const elements = document.createDocumentFragment();

    sorted.forEach((app) => {
      elements.appendChild(app);
    });

    grid.innerHTML = '';
    grid.appendChild(elements);

    // Move the focus to the first matched item
    const first = grid.querySelector(
      '.app-tile:not([data-match="none"]):not([data-match="unknown"])'
    );

    if (first) {
      first.dataset.focus = 'true';
    }
  });
}

setInterval(() => {
  fetchSystemInfo();
  checkStatus();
}, 1000 * 60);

fetchSystemInfo();
checkStatus();
addSearch();
