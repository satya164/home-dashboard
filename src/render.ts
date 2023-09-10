import type { Config } from './types';

const html = String.raw;

export function render({ apps, dashdot }: Config) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="style.css" />
      </head>
      <body>
        <main>
          <div class="content">
            <section class="app-grid">
              ${apps.length === 0
                ? '<p>No apps configured</p>'
                : apps
                    .map(
                      (app) => html`
                        <a
                          href="${app.url.external}"
                          title="${app.name}"
                          target="_blank"
                          class="app-tile"
                        >
                          <img class="app-icon" src="/icons/${app.icon}" />
                          <span class="app-status"></span>
                        </a>
                      `
                    )
                    .join('')}
            </section>
            ${dashdot.url
              ? html`
                  <section class="system-info">
                    <label>
                      <span class="label">CPU</span>
                      <span id="cpu">0%</span>
                    </label>
                    <label>
                      <span class="label">RAM</span>
                      <span id="ram">0%</span>
                    </label>
                    <label>
                      <span class="label">Disk</span>
                      <span id="storage">0 / 0</span>
                    </label>
                  </section>
                `
              : ''}
          </div>
        </main>
        <script src="/index.js"></script>
      </body>
    </html>
  `;
}
