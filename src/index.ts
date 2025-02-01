import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { render } from './render.js';
import type { Config } from './types';

const schemas = {
  info: z.object({
    cpu: z.object({
      cores: z.number(),
    }),
    ram: z.object({
      size: z.number(),
    }),
    storage: z.array(z.object({ size: z.number() })),
  }),
  widgets: z.tuple([
    z.object({
      name: z.literal('cpu'),
      data: z.array(z.object({ load: z.number() })).nullable(),
    }),
    z.object({
      name: z.literal('ram'),
      data: z.object({ load: z.number() }).nullable(),
    }),
    z.object({
      name: z.literal('storage'),
      data: z.array(z.number()).nullable(),
    }),
  ]),
};

const assets = async (
  filepath: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const file = join('public', filepath);

  try {
    await fs.promises.access(file, fs.constants.F_OK);
  } catch (e) {
    res.writeHead(404);
    res.end();
    return;
  }

  const readStream = fs.createReadStream(file);

  switch (file.split('.').pop()) {
    case 'css':
      res.setHeader('Content-Type', 'text/css');
      break;
    case 'js':
      res.setHeader('Content-Type', 'text/javascript');
      break;
    case 'png':
      res.setHeader('Content-Type', 'image/png');
      break;
    case 'jpg':
      res.setHeader('Content-Type', 'image/jpg');
      break;
    case 'svg':
      res.setHeader('Content-Type', 'image/svg+xml');
      break;
  }

  if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.svg')) {
    const stat = await fs.promises.stat(file);

    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('Expires', new Date(Date.now() + 60 * 1000).toUTCString());

    if (req.headers['if-modified-since']) {
      if (req.headers['if-modified-since'] === stat.mtime.toUTCString()) {
        res.writeHead(304);
        res.end();
        return;
      }
    }
  }

  res.writeHead(200);
  readStream.pipe(res);
};

const index = async (res: http.ServerResponse) => {
  try {
    await fs.promises.access('config/config.yml', fs.constants.F_OK);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
      await mkdir('config', { recursive: true });
      await fs.promises.writeFile('config/config.yml', `apps: []\n`);
    }
  }

  const configContent = await fs.promises.readFile(
    'config/config.yml',
    'utf-8'
  );

  console.log('Fetching icons');

  const config: Config = parse(configContent);

  await Promise.all(
    config.apps.map(async (app) => {
      const file = join('public', 'icons', app.icon);

      try {
        await fs.promises.access(file, fs.constants.F_OK);
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
          const type = app.icon.split('.').pop();

          if (type) {
            const res = await fetch(
              `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/refs/heads/main/${type}/${app.icon}`
            );

            if (res.ok && res.body) {
              await mkdir(dirname(file), { recursive: true });

              const fileStream = fs.createWriteStream(file, { flags: 'wx' });

              await finished(Readable.fromWeb(res.body).pipe(fileStream));
            }
          }
        }
      }
    })
  );

  const html = render(config);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(html);
  res.end();
};

const api = async (pathname: string, res: http.ServerResponse) => {
  const configContent = await fs.promises.readFile(
    'config/config.yml',
    'utf-8'
  );

  const config: Config = parse(configContent);

  switch (pathname) {
    case '/api/system-info': {
      const dashdot = config.dashdot;

      if (!dashdot?.url) {
        res.writeHead(501);
        res.end();
        return;
      }

      const info = schemas.info.parse(
        await fetch(new URL(`/info`, dashdot.url)).then((res) => res.json())
      );

      const widgets = ['cpu', 'ram', 'storage'];
      const [cpu, ram, storage] = schemas.widgets.parse(
        await Promise.all(
          widgets.map(async (name) => {
            try {
              return {
                name,
                data: await fetch(new URL(`/load/${name}`, dashdot.url)).then(
                  (res) => res.json()
                ),
              };
            } catch (e) {
              return {
                name,
                data: null,
              };
            }
          })
        )
      );

      const system = {
        cpu: cpu.data?.reduce((avg, { load }, _, self) => {
          return avg + load / self.length;
        }, 0),
        ram: ram.data
          ? {
              used: ram.data.load / (1024 * 1024 * 1024),
              total: info.ram.size / (1024 * 1024 * 1024),
            }
          : null,
        storage: storage.data
          ? storage.data
              .map((it, i) =>
                it >= 0
                  ? {
                      used: it / (1024 * 1024 * 1024),
                      total: info.storage[i].size / (1024 * 1024 * 1024),
                    }
                  : null
              )
              .filter(Boolean)
          : null,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(system));
      res.end();

      break;
    }

    case '/api/status': {
      const status = await Promise.all(
        config.apps.map(async (app) => {
          try {
            const status = await fetch(
              `${app.url.internal}${
                app.request?.path ? `/${app.request.path}` : ''
              }`,
              {
                method: app.request?.method ?? 'HEAD',
              }
            ).then((res) => res.status);

            const online = app.request?.status_codes
              ? app.request.status_codes.includes(status)
              : status >= 200 && status < 300;

            return {
              name: app.name,
              status: online ? 'online' : 'offline',
            };
          } catch (e) {
            return {
              name: app.name,
              status: 'unknown',
            };
          }
        })
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(status));
      res.end();

      break;
    }

    default:
      res.writeHead(404);
      res.end();
  }
};

const host = '0.0.0.0';
const port = 3096;

const server = http.createServer(async (req, res) => {
  console.log('-->', req.method, req.url);

  if (req.url == null) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (req.url === '/') {
    await index(res);
  } else if (req.url.startsWith('/api/')) {
    await api(req.url, res);
  } else {
    await assets(req.url, req, res);
  }

  console.log('<--', req.method, req.url, res.statusCode);
});

server.listen(port, host, () => {
  console.log(`Server is running at http://localhost:${port}\n`);
});
