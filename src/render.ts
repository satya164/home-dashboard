import type { Config } from './types';

const html = String.raw;

export function render({ apps, dashdot, wallpaper }: Config) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="style.css" />
      </head>
      <body
        ${wallpaper
          ? `class="wallpaper" style="--wallpaper: url(${
              'url' in wallpaper
                ? wallpaper.url
                : `/wallpapers/${wallpaper.file}`
            })"`
          : ''}
        }
      >
        <main>
          <div class="content">
            <section class="app-grid">
              ${apps.length === 0
                ? '<p>No apps configured. Edit <code>config/config.yml</code> to add the list of apps to display.</p>'
                : apps
                    .map(
                      (app) => html`
                        <a
                          href="${app.url.external}"
                          title="${app.name}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="app-tile"
                        >
                          <img class="app-icon" src="/icons/${app.icon}" />
                          <span class="app-status"></span>
                        </a>
                      `
                    )
                    .join('')}
            </section>
            ${dashdot?.url
              ? html`
                  <section
                    id="system-info"
                    data-visible="false"
                    class="system-info"
                  >&nbsp;</section>
                `
              : ''}
          </div>
        </main>
        <script src="/index.js"></script>
      </body>
    </html>
  `;
}
