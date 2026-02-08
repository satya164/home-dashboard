import type { z } from 'zod';
import type { schema } from './config.ts';
import type { App } from './types.ts';

const html = String.raw;

export function render(config: z.infer<typeof schema>, apps: App[]) {
  const wallpaper = config.wallpaper
    ? 'url' in config.wallpaper
      ? config.wallpaper.url
      : `/wallpapers/${config.wallpaper.file}`
    : null;

  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <title>Dashboard</title>
        ${wallpaper
          ? `<link rel="preload" as="image" href="${wallpaper}" />`
          : ''}
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
          ? `class="wallpaper" style="--wallpaper: url(${wallpaper})"`
          : ''}
      >
        <main>
          <div class="content">
            <input
              type="text"
              id="search"
              class="search"
              placeholder="Search for apps…"
            />
            <section id="app-grid" class="app-grid">
              ${apps.length === 0
                ? '<p>No apps or docker containers found.</p>'
                : apps
                    .map(
                      (app, i) => html`
                        <a
                          data-name="${app.name}"
                          data-id="${app.id}"
                          data-index="${i}"
                          href="${app.url}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="app-tile"
                        >
                          <img class="app-icon" src="/icons/${app.icon}" />
                          <div class="app-name">${app.name}</div>
                          <span class="app-status"></span>
                        </a>
                      `
                    )
                    .join('')}
            </section>
            <section data-visible="false" id="system-info" class="system-info">
              &nbsp;
            </section>
          </div>
        </main>
        <script src="/index.js"></script>
      </body>
    </html>
  `;
}
