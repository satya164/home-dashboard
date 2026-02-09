import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { z } from 'zod';
import type { schema } from './config.ts';
import { docker, getContainerName, getImageName } from './docker.ts';
import { getTraefikRoutes } from './traefik.ts';
import type { App, AppStatus } from './types.ts';

type Config = z.infer<typeof schema>;

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
      containers.map(async (container) => {
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
          image: getImageName(container),
          icon: undefined,
          name: displayName,
          url,
        };
      })
    )
  ).filter((app) => app != null);

  // Build apps from config entries without a container
  const customApps = (
    await Promise.all(
      (config.apps ?? []).map(async (app) => {
        if (
          app.container &&
          !containers.some((c) => getContainerName(c) === app.container)
        ) {
          throw new Error(
            `Configured app "${app.container}" not found among Docker containers.`
          );
        }

        if (!app.url) {
          return null;
        }

        const name = app.name ?? app.container;

        if (name == null) {
          throw new Error(
            `App must have either a "name" or "container" specified (got ${JSON.stringify(app)}).`
          );
        }

        return {
          id: app.container || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          image: undefined,
          container: app.container,
          icon: app.icon,
          name,
          url: app.url,
        };
      })
    )
  ).filter((app) => app != null);

  const apps = [
    ...containerApps.filter((app) =>
      customApps.some((c) => c.container !== app.container)
    ),
    ...customApps.map((app) => {
      if (app.container) {
        const match = containerApps.find((c) => c.container === app.container);
        return { ...match, ...app };
      }

      return app;
    }),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return await Promise.all(
    apps.map(async (app): Promise<App> => {
      let icon;

      if (app.icon) {
        await downloadIconFile(app.icon);

        icon = app.icon;
      } else if (app.image || app.container) {
        icon = await resolveIcon(
          ...[app.image, app.container].filter((name) => name != null)
        );
      }

      return { ...app, icon };
    })
  );
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

const attemptedDownloads = new Set<string>();

async function downloadIconFile(filename: string) {
  const file = join(ICON_DIR, filename);

  try {
    await fs.promises.access(file);
    return true;
  } catch {
    // File doesn't exist, continue to download
  }

  // If download was already attempted and failed, don't try again to avoid repeated failed attempts
  if (attemptedDownloads.has(filename)) {
    return false;
  }

  if (!filename.includes('.')) {
    throw new Error(`Filename "${filename}" does not have an extension.`);
  }

  const ext = filename.split('.').pop();

  try {
    attemptedDownloads.add(filename);

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

async function resolveIcon(...names: string[]) {
  const candidates = names.flatMap((name) =>
    ICON_EXTENSIONS.map((ext) => `${name}.${ext}`)
  );

  for (const filename of candidates) {
    try {
      await fs.promises.access(join(ICON_DIR, filename));
      return filename;
    } catch {
      // not found, continue
    }
  }

  for (const filename of candidates) {
    if (await downloadIconFile(filename)) {
      return filename;
    }
  }

  return undefined;
}
