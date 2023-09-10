# Dashboard

A simple dashboard for homelab with [dashdot](https://getdashdot.com/) integration.

## Development

To install dependencies:

```bash
npm install
```

To run the app:

```bash
npm run dev
```

## Configuration

The app can be configured using a `config.yml` file in the `config` directory.

```yaml
# The list of apps to show on the dashboard
apps:
  - name: HomeAssistant
    url: https://assistant.mydomain.com
    icon: home-assistant.png
  - name: Jellyfin
    url: https://jellyfin.mydomain.com
    icon: jellyfin.png

# The URL of the dashdot server to fetch CPU, RAM, and disk usage
dashdot:
  url: https://dashdot.mydomain.com
```

Any icons placed in the `public/icons` directory will be available for use in the config.

## Docker

To build a Docker image:

```bash
docker build --platform=linux/amd64 . -t satya164/dashboard
```

To run the Docker image:

```bash
docker run -p 3096:3096 -v /path/to/config:/app/config -v /path/to/icons:/app/public/icons satya164/dashboard
```

## Deployment

The project can be deployed using [Docker](https://www.docker.com/).

Sample `docker-compose.yml`:

```yaml
name: dashboard
services:
  dashboard:
    container_name: dashboard
    image: satya164/dashboard:latest
    ports:
      - target: 3096
        published: "3096"
        protocol: tcp
    cpu_shares: 10
    restart: unless-stopped
    volumes:
      - type: bind
        source: /DATA/AppData/dashboard/config
        target: /app/config
      - type: bind
        source: /DATA/AppData/dashboard/icons
        target: /app/public/icons
    network_mode: bridge
    privileged: false
x-casaos:
  author: self
  category: self
  hostname: ""
  index: /
  port_map: "3096"
  scheme: http
  title:
    custom: Dashboard
```
