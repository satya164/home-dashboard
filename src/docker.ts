import Docker from 'dockerode';

const DEFAULT_SOCKET = '/var/run/docker.sock';

export const docker = createDockerClient();

export function getImageName(container: Docker.ContainerInfo) {
  const image = container.Image ?? '';
  return image.replace(/:.*$/, '').split('/').pop() ?? '';
}

export function getContainerName(container: Docker.ContainerInfo) {
  const [first] = container.Names ?? [];

  if (first) {
    return first.replace(/^\//, '');
  }

  return null;
}

export function getPortFallback(container: Docker.ContainerInfo) {
  const port = container.Ports?.find((item: Docker.Port) =>
    Boolean(item.PublicPort)
  );

  if (!port) {
    return null;
  }

  const host = port.IP && port.IP !== '0.0.0.0' ? port.IP : 'localhost';

  return `http://${host}:${port.PublicPort}`;
}

function createDockerClient() {
  const host = process.env.DOCKER_HOST ?? `unix://${DEFAULT_SOCKET}`;

  if (host.startsWith('unix://') || host.startsWith('/')) {
    return new Docker({ socketPath: host.replace(/^unix:\/\//, '') });
  }

  // Normalize tcp:// to http:// for URL parsing
  const normalized = host.replace(/^tcp:\/\//, 'http://');
  const url = new URL(normalized);
  const protocol = url.protocol === 'https:' ? 'https' : 'http';

  return new Docker({
    host: url.hostname,
    port: Number(url.port || (protocol === 'https' ? 443 : 2375)),
    protocol,
  });
}
