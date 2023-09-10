import { parse } from 'yaml';
import { render } from './render';
import type { Config } from './types';

const assets = (path: string) => {
  const file = Bun.file(`public/${path}`);

  return new Response(file);
};

const index = async () => {
  const config = Bun.file('config/config.yml');
  const yaml: Config = parse(await config.text());

  const html = render(yaml);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
};

const api = async (path: string) => {
  const config = Bun.file('config/config.yml');
  const yaml: Config = parse(await config.text());

  switch (path) {
    case '/api/system-info': {
      const info = await fetch(new URL(`/info`, yaml.dashdot.url)).then((res) =>
        res.json()
      );

      const widgets = ['cpu', 'ram', 'storage'];
      const [cpu, ram, storage] = await Promise.all(
        widgets.map(async (name) => {
          return {
            name,
            data: await fetch(new URL(`/load/${name}`, yaml.dashdot.url)).then(
              (res) => res.json()
            ),
          };
        })
      );

      const system = {
        cpu: cpu.data.reduce(
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
        ram: (ram.data.load / info.ram.size) * 100,
        storage: {
          used: storage.data[0] / (1024 * 1024 * 1024),
          total: info.storage[0].size / (1024 * 1024 * 1024),
        },
      };

      return new Response(JSON.stringify(system), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    case '/api/status': {
      const status = await Promise.all(
        yaml.apps.map(async (app: any) => {
          const url = new URL(app.url);
          const status = await fetch(url).then((res) => res.status);

          return {
            name: app.name,
            status,
          };
        })
      );

      return new Response(JSON.stringify(status), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    default:
      return new Response(`404!`);
  }
};

const server = Bun.serve({
  port: 3096,
  fetch(req) {
    console.log('Request:', req.url);

    let path = new URL(req.url).pathname;

    if (path === '/') {
      return index();
    }

    if (path.startsWith('/api/')) {
      return api(path);
    }

    return assets(path);
  },
});

console.log(`Listening on http://${server.hostname}:${server.port}`);
