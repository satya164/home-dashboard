import type Docker from 'dockerode';
import type { z } from 'zod';
import type { schema } from './config.ts';
import { getContainerName } from './docker.ts';

export type RouteInfo = {
  url: string;
  host: string;
};

export async function getTraefikRoutes(
  config: z.infer<typeof schema>,
  containers: Docker.ContainerInfo[]
): Promise<Map<string, RouteInfo[]>> {
  if (!config.traefik?.url) {
    return new Map();
  }

  const response = await fetch(
    new URL('/api/http/routers', config.traefik.url)
  );

  if (!response.ok) {
    throw new Error(
      `Traefik API returned ${response.status}: ${response.statusText}`
    );
  }

  const routers = await response.json();

  if (!Array.isArray(routers)) {
    throw new Error(
      `Unexpected Traefik API response: ${JSON.stringify(routers)}`
    );
  }

  const serviceMap = buildServiceMap(containers);
  const routes = new Map<string, RouteInfo[]>();

  for (const router of routers) {
    if (typeof router?.service !== 'string') continue;

    const container = resolveService(router.service.split('@')[0], serviceMap);

    if (!container) {
      continue;
    }

    const rule = String(router.rule ?? '');
    const hostMatches = rule.matchAll(/Host\(([^)]+)\)/g);

    const hosts = [...hostMatches]
      .flatMap((m) => m[1].split(','))
      .map((h) => h.replace(/[`'\s]/g, ''))
      .filter(Boolean);

    if (!hosts.length) {
      continue;
    }

    const scheme = router.tls ? 'https://' : 'http://';
    const existing = routes.get(container) ?? [];
    const seen = new Set(existing.map((r) => r.host));

    const newRoutes = hosts
      .filter((host) => !seen.has(host))
      .map((host) => ({
        url: host.startsWith('http') ? host : `${scheme}${host}`,
        host,
      }));

    routes.set(container, [...existing, ...newRoutes]);
  }

  return routes;
}

function buildServiceMap(containers: Docker.ContainerInfo[]) {
  const map = new Map<string, string>();

  for (const container of containers) {
    const name = getContainerName(container);

    if (!name) {
      continue;
    }

    const labels = container.Labels ?? {};

    const traefikServicePrefix = 'traefik.http.services.';
    const traefikServices = Object.keys(labels)
      .filter((l) => l.startsWith(traefikServicePrefix))
      .map((l) => l.slice(traefikServicePrefix.length).split('.')[0]);

    const keys = new Set([
      name,
      labels['com.docker.compose.service'],
      labels['com.docker.stack.service.name'],
      ...traefikServices,
    ]);

    for (const key of keys) {
      if (key) {
        map.set(key, name);
      }
    }
  }

  return map;
}

function resolveService(name: string, map: Map<string, string>) {
  if (map.has(name)) {
    return map.get(name)!;
  }

  // Traefik often uses both service and container names (e.g. "service-container")
  // So we try to match by splitting the name and checking for parts in either direction
  const parts = name.split('-').filter(Boolean);

  for (let i = 1; i < parts.length; i++) {
    const left = parts.slice(i).join('-');

    if (map.has(left)) {
      return map.get(left);
    }

    const right = parts.slice(0, -i).join('-');

    if (map.has(right)) {
      return map.get(right);
    }
  }

  return null;
}
