import fs from 'node:fs';
import http from 'node:http';
import { join, normalize, resolve } from 'node:path';
import {
  discoverApps,
  getStatuses,
  subscribeIcons,
} from './apps.ts';
import { loadConfig } from './config.ts';
import { render } from './render.ts';
import { getSystemInfo } from './system.ts';

const host = '0.0.0.0';
const port = 3096;

const server = http.createServer(async (req, res) => {
  console.log('-->', req.method, req.url);

  try {
    if (req.url == null) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.url === '/') {
      await index(res);
    } else if (req.url.startsWith('/api/')) {
      await api(req.url, req, res);
    } else {
      await asset(req.url, req, res);
    }
  } catch (error) {
    console.error('Request failed:', req.method, req.url, error);

    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
  }

  console.log('<--', req.method, req.url, res.statusCode);
});

server.listen(port, host, () => {
  console.log(`Server is running at http://localhost:${port}\n`);
});

async function index(res: http.ServerResponse) {
  const config = await loadConfig();
  const apps = await discoverApps(config);

  const html = render(config, apps);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(html);
  res.end();
}

async function api(pathname: string, req: http.IncomingMessage, res: http.ServerResponse) {
  switch (pathname) {
    case '/api/system-info': {
      const system = await getSystemInfo();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(system));
      res.end();

      break;
    }

    case '/api/status': {
      const config = await loadConfig();
      const status = await getStatuses(config);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(status));
      res.end();

      break;
    }

    case '/api/icons': {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const unsubscribe = subscribeIcons(
        (update) => {
          res.write(`data: ${JSON.stringify(update)}\n\n`);
        },
        () => {
          res.write('event: done\ndata:\n\n');
          res.end();
        }
      );

      req.on('close', unsubscribe);

      break;
    }

    default:
      res.writeHead(404);
      res.end();
  }
}

async function asset(
  filepath: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const publicDir = resolve('public');
  const file = normalize(join('public', filepath));

  if (!resolve(file).startsWith(publicDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

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
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    );

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
}
