import fs from 'node:fs';
import http from 'node:http';
import { parse } from 'yaml';
import { render } from './render.js';
import type { Config } from './types';

const assets = async (filepath: string, res: http.ServerResponse) => {
  try {
    await fs.promises.access('public/' + filepath, fs.constants.F_OK);
  } catch (e) {
    res.writeHead(404);
    res.end();
    return;
  }

  const readStream = fs.createReadStream('public/' + filepath);

  res.writeHead(200);
  readStream.pipe(res);
};

const index = async (res: http.ServerResponse) => {
  const configContent = await fs.promises.readFile(
    'config/config.yml',
    'utf-8'
  );

  const config: Config = parse(configContent);

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

      const info = await fetch(new URL(`/info`, dashdot.url)).then(
        (res) => res.json()
      );

      const widgets = ['cpu', 'ram', 'storage'];
      const [cpu, ram, storage] = await Promise.all(
        widgets.map(async (name) => {
          try {
            return {
              name,
              data: await fetch(
                new URL(`/load/${name}`, dashdot.url)
              ).then((res) => res.json()),
            };
          } catch (e) {
            return {
              name,
              data: null,
            };
          }
        })
      );

      const system = {
        cpu: cpu.data?.reduce(
          (
            avg: number,
            { load }: { load: number },
            _: number,
            self: Array<{ load: number }>
          ) => {
            return avg + load / self.length;
          },
          0
        ),
        ram: ram.data ? (ram.data.load / info.ram.size) * 100 : null,
        storage: storage.data
          ? {
              used: storage.data[0] / (1024 * 1024 * 1024),
              total: info.storage[0].size / (1024 * 1024 * 1024),
            }
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
            const status = await fetch(app.url.internal, {
              method: app.request?.method ?? 'HEAD',
            }).then((res) => res.status);

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

const server = http.createServer((req, res) => {
  console.log('Request:', req.url);

  if (req.url == null) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (req.url === '/') {
    return index(res);
  }

  if (req.url.startsWith('/api/')) {
    return api(req.url, res);
  }

  return assets(req.url, res);
});

server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
