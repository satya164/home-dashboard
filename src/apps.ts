import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { z } from 'zod';
import type { schema } from './config.ts';
import { docker, getContainerName } from './docker.ts';
import { getTraefikRoutes } from './traefik.ts';
import type { App, AppStatus } from './types.ts';

type Config = z.infer<typeof schema>;

const DEFAULT_ICON = 'docker.svg';
const ICON_SOURCE =
  'https://raw.githubusercontent.com/homarr-labs/dashboard-icons/refs/heads/main';
const ICON_EXTENSIONS = ['svg', 'webp', 'png'];
const ICON_DIR = join('public', 'icons');

export async function discoverApps(config: Config): Promise<App[]> {
  const containers = await docker.listContainers({ all: true });
  const routeMap = await getTraefikRoutes(config, containers);

  // Build apps from Docker containers
  const containerApps = (
    await Promise.all(
      containers.map(async (container): Promise<App | null> => {
        const name = getContainerName(container);

        if (!name || config.ignore?.includes(name)) {
          return null;
        }

        const custom = config.apps?.find((app) => app.container === name);

        const displayName =
          custom?.name ??
          name
            .replace(/[-_]+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

        const icon = custom?.icon
          ? (await downloadIcon(custom.icon), custom.icon)
          : await resolveIcon(name);

        let url = custom?.url;

        if (!url) {
          const urls = routeMap
            .get(name)
            ?.map((route) => route.url)
            .sort((a, b) => {
              return (
                (a.endsWith('.local') ? 1 : 0) - (b.endsWith('.local') ? 1 : 0)
              );
            });

          url = urls?.[0];
        }

        if (!url) {
          return null;
        }

        return {
          id: name,
          container: name,
          name: displayName,
          icon,
          url,
        };
      })
    )
  ).filter((app): app is App => app != null);

  // Build apps from config entries without a container
  const customApps = (
    await Promise.all(
      (config.apps ?? []).map(async (app): Promise<App | null> => {
        if (
          app.container &&
          !containers.some((c) => getContainerName(c) === app.container)
        ) {
          throw new Error(
            `Configured app "${app.container}" not found among Docker containers.`
          );
        }

        if (!app.name || !app.url) {
          return null;
        }

        const icon = app.icon
          ? (await downloadIcon(app.icon), app.icon)
          : DEFAULT_ICON;

        return {
          id:
            app.container || app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: app.name,
          icon,
          url: app.url,
        };
      })
    )
  ).filter((app): app is App => app != null);

  return [
    ...containerApps.filter((app) =>
      customApps.some((c) => c?.container === app?.container)
    ),
    ...customApps.map((app) => {
      if (app.container) {
        const match = containerApps.find((c) => c.container === app.container);
        return { ...match, ...app };
      }

      return app;
    }),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStatuses(config: Config): Promise<AppStatus[]> {
  const containers = await docker.listContainers({ all: true });
  const configApps = config.apps ?? [];

  const containerStatuses: AppStatus[] = containers
    .map((container) => {
      const name = getContainerName(container) ?? '';

      if (!name || config.ignore?.includes(name)) {
        return null;
      }

      const custom = configApps.find((app) => app.container === name);

      // If the app has a request config, skip container state — it'll be checked via HTTP below
      if (custom?.request) {
        return null;
      }

      return {
        id: name,
        state: container.State,
      };
    })
    .filter((s): s is AppStatus => s != null);

  // Collect apps that need HTTP checks:
  // - container apps with explicit `request` config
  // - non-container apps (always HTTP check)
  const httpApps = configApps.filter(
    (app) => app.request || (!app.container && app.url)
  );

  const httpStatuses = await Promise.all(
    httpApps.map(async (app): Promise<AppStatus | null> => {
      const url = app.url;

      if (!url) {
        return null;
      }

      const id =
        app.container ?? app.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (!id) {
        return null;
      }

      return {
        id,
        state: await checkHttp(url, app.request),
      };
    })
  );

  return [...containerStatuses, ...httpStatuses].filter(
    (s): s is AppStatus => s != null
  );
}

async function checkHttp(
  url: string,
  request?: { method?: string; status_codes?: number[] }
): Promise<string> {
  try {
    const method = request?.method ?? 'HEAD';
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    const codes = request?.status_codes;

    if (codes) {
      return codes.includes(response.status) ? 'running' : 'exited';
    }

    return response.status >= 200 && response.status < 300
      ? 'running'
      : 'exited';
  } catch {
    return 'exited';
  }
}

async function downloadIcon(filename: string) {
  const file = join(ICON_DIR, filename);

  try {
    await fs.promises.access(file);
    return true;
  } catch {
    // File doesn't exist, continue to download
  }

  if (!filename.includes('.')) {
    throw new Error(`Filename "${filename}" does not have an extension.`);
  }

  const ext = filename.split('.').pop();

  try {
    const response = await fetch(`${ICON_SOURCE}/${ext}/${filename}`);

    if (response.ok && response.body) {
      await mkdir(ICON_DIR, { recursive: true });

      await finished(
        Readable.fromWeb(response.body).pipe(
          fs.createWriteStream(file, { flags: 'wx' })
        )
      );

      return true;
    }
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      return true;
    }

    console.warn(`Failed to download icon: ${filename}`, error);
  }

  return false;
}

async function resolveIcon(name: string) {
  const key = name.toLowerCase();
  const candidates = ICON_EXTENSIONS.map((ext) => `${key}.${ext}`);

  // Check if any extension already exists locally
  for (const filename of candidates) {
    try {
      await fs.promises.access(join(ICON_DIR, filename));
      return filename;
    } catch {
      // not found, continue
    }
  }

  // Try downloading in priority order
  for (const filename of candidates) {
    if (await downloadIcon(filename)) return filename;
  }

  return DEFAULT_ICON;
}
