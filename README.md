# Dashboard

A simple dashboard for homelab with [dashdot](https://getdashdot.com/) integration.

## Development

Install dependencies:

```bash
npm install
```

Copy the sample config file from the [Configuration](#configuration) section to `config/config.yml`.

Run the app:

```bash
npm run dev
```

## Configuration

The app can be configured using a `config.yml` file in the `config` directory.

```yaml
# The list of apps to show on the dashboard
apps:
  - name: HomeAssistant
    icon: home-assistant.png
    url:
      internal: http://192.168.0.100:8123
      external: https://assistant.mydomain.com
  - name: Jellyfin
    icon: jellyfin.png
    url:
      internal: http://192.168.0.100:8096
      external: https://jellyfin.mydomain.com

# The internal URL of the dashdot server to fetch CPU, RAM, and disk usage
dashdot:
  url: http://192.168.0.100:3001
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
      - 3096:3096
    volumes:
      - /DATA/AppData/dashboard/config:/app/config
      - /DATA/AppData/dashboard/icons:/app/public/icons
    restart: unless-stopped
```
