# Dashboard

A dashboard for homelab with [dashdot](https://getdashdot.com/) integration to show the server stats.

![Dashboard](demo.png)

![Search](demo-search.png)

Wallpaper by [Unsplash](https://unsplash.com/photos/the-night-sky-is-filled-with-stars-above-the-ocean--Qi1aO87fP4).

## Installation

The app can be installed using [Docker](https://www.docker.com/) or by running the app directly.

Sample `docker-compose.yml`:

```yaml
name: dashboard
services:
  dashboard:
    container_name: dashboard
    image: ghcr.io/satya164/home-dashboard:main
    ports:
      - 3096:3096
    volumes:
      - /DATA/AppData/dashboard/config:/app/config
      - /DATA/AppData/dashboard/icons:/app/public/icons
      - /DATA/AppData/dashboard/wallpapers:/app/public/wallpapers
    restart: unless-stopped
```

Make sure to replace `/DATA/AppData/dashboard` with the path to the directory where the configuration and assets are stored.

## Configuration

The app can be configured using a `config.yml` file in the `config` directory.

The configuration file supports the following options:

- `apps`: The list of apps to show on the dashboard
  - `name`: The name of the app
  - `icon`: The icon file for the app in the `public/icons` directory
  - `url`: URLs for the app
    - `internal`: The internal URL to check if the app is running
    - `external`: The external URL to open the app on click
  - `request`: The request options to check the app status (optional)
    - `method`: The HTTP method to use (default: `HEAD`)
    - `status_codes`: The list of status codes to check (default: `[200]`)
    - `path`: The path to check (default: `/`)
- `dashdot`: Configuration for dashdot (optional)
  - `url`: The internal URL of the dashdot server
- `wallpaper`: Configuration for the wallpaper (optional)
  - `url`: The wallpaper URL to use
  - `file`: The wallpaper file in the `public/wallpapers` directory

Internal URLs refer to the local network URLs, or any URL that can be accessed by the server.

The assets can be placed in the `public` directory:

- `public/icons`: Icons for the apps
- `public/wallpapers`: Wallpapers for the dashboard

If an icon is specified, but not found in the `public/icons` directory, it'll be downloaded from [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons) and saved in the `public/icons` directory.

The app uses [dashdot](https://getdashdot.com/) to show the CPU, RAM, and disk usage of the server. The `dashdot` configuration is optional.

Sample `config.yml`:

```yaml
apps:
  - name: HomeAssistant
    icon: home-assistant.svg
    url:
      internal: http://192.168.0.100:8123
      external: https://assistant.mydomain.com
  - name: Jellyfin
    icon: jellyfin.svg
    url:
      internal: http://192.168.0.100:8096
      external: https://jellyfin.mydomain.com
  - name: File Browser
    icon: filebrowser.svg
    url:
      internal: http://192.168.0.100:6080
      external: https://files.mydomain.com
    request:
      method: GET
  - name: Syncthing
    icon: syncthing.svg
    url:
      internal: http://192.168.0.100:8384
      external: https://syncthing.mydomain.com
    request:
      status_codes:
        - 200
        - 401

dashdot:
  url: http://192.168.0.100:3001

wallpaper:
  url: https://images.unsplash.com/flagged/photo-1551301622-6fa51afe75a9
```

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

To build the Docker image:

```bash
docker build . -t ghcr.io/satya164/home-dashboard:main
```

Or with Podman:

```bash
podman build . -t ghcr.io/satya164/home-dashboard:main
```

To run the Docker image:

```bash
docker run -p 3096:3096 -v ./config:/app/config -v ./public/icons:/app/public/icons -v ./public/wallpapers:/app/public/wallpapers ghcr.io/satya164/home-dashboard:main
```

Or with Podman:

```bash
podman run -p 3096:3096 -v ./config:/app/config -v ./public/icons:/app/public/icons -v ./public/wallpapers:/app/public/wallpapers ghcr.io/satya164/home-dashboard:main
```
