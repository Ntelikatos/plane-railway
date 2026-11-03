# Architecture

This template runs [Plane](https://plane.so) Community Edition, the AGPL-3.0 open-source edition, on Railway. Each service in Plane's official Docker Compose file becomes one Railway service. The source is the compose file attached to the Plane release, [`docker-compose.yml` for v1.4.3](https://github.com/makeplane/plane/releases/download/v1.4.3/docker-compose.yml). Plane documents Docker Compose, Kubernetes and Podman as its self-hosting methods ([developers.plane.so/self-hosting/overview](https://developers.plane.so/self-hosting/overview)). This template follows the Docker Compose one.

## Services

```
                 Railway edge (HTTPS, public domain)
                              │
                           proxy  (Caddy, Plane's routes)
   ┌──────────┬──────────┬────┴─────┬───────────┬──────────────┐
   /*        /spaces/*  /god-mode/* /live/*     /api/* /auth/*  /uploads/*
   web       space      admin       live        api            plane-minio
                                     │           │
                                     │     worker, beat-worker
                                     │           │
                          plane-redis ◄──────────┼──► plane-mq
                                                 ▼
                                             plane-db
```

| Railway service | Image | Compose service | Volume |
| --- | --- | --- | --- |
| `proxy` | built from `proxy/Dockerfile` on `makeplane/plane-proxy:v1.4.3` | `proxy` | none |
| `web` | `makeplane/plane-frontend:v1.4.3` | `web` | none |
| `space` | `makeplane/plane-space:v1.4.3` | `space` | none |
| `admin` | `makeplane/plane-admin:v1.4.3` | `admin` | none |
| `live` | `makeplane/plane-live:v1.4.3` | `live` | none |
| `api` | `makeplane/plane-backend:v1.4.3` | `api` and `migrator` | none |
| `worker` | `makeplane/plane-backend:v1.4.3` | `worker` | none |
| `beat-worker` | `makeplane/plane-backend:v1.4.3` | `beat-worker` | none |
| `plane-db` | `postgres:15.7-alpine` | `plane-db` | `/var/lib/postgresql/data` |
| `plane-redis` | `valkey/valkey:7.2.11-alpine` | `plane-redis` | `/data` |
| `plane-mq` | `rabbitmq:3.13.6-management-alpine` | `plane-mq` | `/var/lib/rabbitmq` |
| `plane-minio` | `pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | `plane-minio` | `/export` |

Every image is pinned to the tag in Plane's compose file for the release. `.railway/railway.ts` holds the same list as code.

## How each compose setting was translated

Railway's guide [Deploy a Docker Compose App to Production](https://docs.railway.com/guides/docker-compose) gives the mapping: each compose service becomes a Railway service, `image:` becomes a Docker image source, named volumes become Railway volumes at the same mount path, and `networks:` and `depends_on:` have no equivalent.

- **Hostnames.** Compose services reach each other by service name (`api:8000`). Railway services reach each other at `<service>.railway.internal` ([private networking](https://docs.railway.com/networking/private-networking/how-it-works#internal-dns)). Connection strings are built from `RAILWAY_PRIVATE_DOMAIN` with [reference variables](https://docs.railway.com/variables#referencing-another-services-variable), as Railway's [template best practices](https://docs.railway.com/templates/best-practices#private-networking) recommend.
- **The proxy.** Plane's Caddyfile names the compose hostnames directly, so `proxy/Dockerfile` copies a Caddyfile that reads them from variables instead. The routes are Plane's. The ACME block is gone because Railway's edge terminates TLS, and Caddy listens on plain HTTP on `PORT`.
- **Start commands.** On Railway a start command replaces the image `ENTRYPOINT` in exec form ([start command](https://docs.railway.com/deployments/start-command)). Where compose set `command:`, the Railway start command calls the image's entrypoint script first. Without it Postgres would skip `initdb` and Valkey would run as root.
- **Migrations.** Compose runs a one-shot `migrator` container. Here it is the `api` service's [pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command), which runs Plane's `docker-entrypoint-migrator.sh` before each `api` deploy. `api`, `worker` and `beat-worker` already wait for migrations at startup.
- **Ports.** Railway injects `PORT` and runs healthchecks against it ([healthchecks](https://docs.railway.com/deployments/healthchecks#configure-the-healthcheck-port)). `api`, `space` and `live` bind to `PORT`, so every service sets it to the port Plane's images use (8000 for `api`, 3000 for the frontends and `live`, 80 for `proxy`).
- **Secrets.** Compose ships fixed defaults such as `POSTGRES_PASSWORD=plane`. Here every password and key is a [template variable function](https://docs.railway.com/templates/create#template-variable-functions), `${{ secret(...) }}`, so Railway generates it when the template is deployed, or on the first `railway config apply` of `.railway/railway.ts`. Railway stores the expression next to the value and keeps the value on later applies of the same expression (observed with Railway CLI 5.71.0). Each secret is generated once on one service and referenced by the others: `SECRET_KEY` on `api` is shared with `worker` and `beat-worker`, and `LIVE_SERVER_SECRET_KEY` on `api` is shared with `live`.
- **Valkey password.** Plane's compose file runs Valkey without one. Railway's [best practices](https://docs.railway.com/templates/best-practices#authentication) ask templates to turn on authentication wherever the software has it, so Valkey starts with `--requirepass` and `REDIS_URL` carries the password.
- **Postgres data directory.** A fresh Railway volume holds a `lost+found` directory, and `initdb` refuses a non-empty directory. `PGDATA` points one level down, at `/var/lib/postgresql/data/pgdata`, the same layout Railway's own Postgres template uses.
- **RabbitMQ node name.** RabbitMQ names its data directory after the node, and the node name defaults to the hostname. A Railway container gets a new hostname on every deploy, so `RABBITMQ_NODENAME` is fixed at `rabbit@localhost`.
- **Upload URLs.** Plane signs upload URLs for the host the browser used. Railway serves the public domain over HTTPS only, so `MINIO_ENDPOINT_SSL=1` makes Plane sign `https://` URLs. Plane's `variables.env` describes this setting as the switch for SSL termination.

## Left out

- **Log volumes** (`logs_api`, `logs_worker`, `logs_beat-worker`, `logs_migrator`). Plane also writes its logs to stdout, which Railway keeps in the service logs.
- **Caddy's `proxy_config` and `proxy_data` volumes.** They hold ACME certificates, and Railway's edge handles TLS.
- **Settings equal to Plane's defaults.** `DEBUG`, `API_KEY_RATE_LIMIT`, `FILE_SIZE_LIMIT` and `AWS_REGION` are not set; Plane's [`settings/common.py`](https://github.com/makeplane/plane/blob/v1.4.3/apps/api/plane/settings/common.py) defaults them to the compose file's values, and the Caddyfile defaults `FILE_SIZE_LIMIT` the same way.
- **Railway-managed Postgres and Redis.** Railway's compose guide suggests its managed databases. This template keeps Plane's own pinned images instead, so the database versions match what Plane tests a release with.

## Infrastructure as code

`.railway/railway.ts` is a [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) file using only the documented helpers `service`, `image`, `github` and `volume` ([reference](https://docs.railway.com/infrastructure-as-code/reference)). It describes the same project the template deploys. Two parts rely on behaviour observed rather than documented, both checked with Railway CLI 5.71.0: `networking.serviceDomains` with the `<hasDomain>` key creates the proxy's generated domain, and Railway evaluates `${{secret()}}` in values applied from the file. The published template is built from this file; [template-maintenance.md](template-maintenance.md) covers the one step that happens in Railway's template editor. Railway's older `railway.json` Config as Code is deprecated and stops being read on 2026-12-01, so this repository does not ship one.
