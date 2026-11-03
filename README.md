# Plane Community Edition on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/TEMPLATE_CODE?utm_medium=integration&utm_source=button&utm_campaign=plane-ce)

[![Docker Build](https://github.com/Ntelikatos/plane-railway/actions/workflows/docker-build.yml/badge.svg)](https://github.com/Ntelikatos/plane-railway/actions/workflows/docker-build.yml)
[![Validate Config](https://github.com/Ntelikatos/plane-railway/actions/workflows/validate.yml/badge.svg)](https://github.com/Ntelikatos/plane-railway/actions/workflows/validate.yml)
[![Lint Dockerfile](https://github.com/Ntelikatos/plane-railway/actions/workflows/lint-dockerfile.yml/badge.svg)](https://github.com/Ntelikatos/plane-railway/actions/workflows/lint-dockerfile.yml)
[![Trivy Security Scan](https://github.com/Ntelikatos/plane-railway/actions/workflows/trivy.yml/badge.svg)](https://github.com/Ntelikatos/plane-railway/actions/workflows/trivy.yml)

Self-host [Plane](https://plane.so) Community Edition, the open-source project management tool, on Railway in one click. This template runs Plane's official Docker Compose setup for release **v1.4.3**, one Railway service per container, with persistent volumes, generated secrets and a single public HTTPS domain.

Community Edition is the AGPL-3.0 edition. It includes work items, cycles, modules, pages, intake, estimates, the REST API and webhooks, with no user limit. The GitHub, GitLab and Slack integrations, custom properties, epics and the wiki are in Plane's commercial editions and not in this one ([plane.so/open-source](https://plane.so/open-source)).

## Deploy

1. Click **Deploy on Railway** above. There is nothing to fill in: every password and key is generated during the deploy.
2. Wait until every service shows **Active**. The first deploy takes a few minutes, because `api` runs Plane's database migrations before it starts.
3. Open the public domain of the `proxy` service, then go to `/god-mode` on that domain and create the instance admin account.
4. Go back to the domain root, sign in, and create your first workspace.

To use your own domain, add it to the `proxy` service under **Settings > Networking**. `WEB_URL` and `CORS_ALLOWED_ORIGINS` on `api` follow the proxy's public domain, so redeploy `api`, `worker` and `beat-worker` once the domain is active.

## What runs

| Service | What it does | Public |
| --- | --- | --- |
| `proxy` | Caddy with Plane's routes; the only public service | Yes |
| `web` | The Plane web app | No |
| `space` | Public pages for published projects (`/spaces`) | No |
| `admin` | Instance admin panel (`/god-mode`) | No |
| `live` | Real-time collaboration for pages (`/live`) | No |
| `api` | Django REST API; runs migrations before each deploy | No |
| `worker` | Celery background jobs | No |
| `beat-worker` | Celery scheduled jobs | No |
| `plane-db` | Postgres 15, volume at `/var/lib/postgresql/data` | No |
| `plane-redis` | Valkey 7.2, volume at `/data` | No |
| `plane-mq` | RabbitMQ 3.13, volume at `/var/lib/rabbitmq` | No |
| `plane-minio` | S3-compatible file storage, volume at `/export` | No |

Every image is pinned to the tag in Plane's release compose file. [docs/architecture.md](docs/architecture.md) explains how each compose setting maps to Railway, with the Railway and Plane docs behind each choice.

## Variables

Every variable is set by the template. You don't need to change any of them for a working deploy. The ones marked **generated** are random values Railway creates at deploy time with `${{ secret(...) }}`. They are never stored in this repository.

### `api`

| Variable | Value | What it is |
| --- | --- | --- |
| `SECRET_KEY` | generated, 50 chars | Django secret key; shared with `worker` and `beat-worker` |
| `LIVE_SERVER_SECRET_KEY` | generated, 64 hex chars | Shared secret between `api` and `live` |
| `WEB_URL` | `https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}` | Public URL, used in emails and links |
| `CORS_ALLOWED_ORIGINS` | `https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}` | Origins allowed to call the API |
| `DATABASE_URL` | `${{plane-db.DATABASE_URL}}` | Postgres connection string |
| `REDIS_URL` | `${{plane-redis.REDIS_URL}}` | Valkey connection string |
| `AMQP_URL` | `${{plane-mq.AMQP_URL}}` | RabbitMQ connection string |
| `USE_MINIO` | `1` | Use the bundled object storage |
| `MINIO_ENDPOINT_SSL` | `1` | Sign upload URLs as `https://`, because Railway ends TLS at its edge |
| `AWS_ACCESS_KEY_ID` | `${{plane-minio.MINIO_ROOT_USER}}` | Storage access key |
| `AWS_SECRET_ACCESS_KEY` | `${{plane-minio.MINIO_ROOT_PASSWORD}}` | Storage secret key |
| `AWS_S3_ENDPOINT_URL` | `${{plane-minio.S3_ENDPOINT_URL}}` | Storage endpoint on the private network |
| `AWS_S3_BUCKET_NAME` | `uploads` | Bucket name; Plane creates it on start |
| `GUNICORN_WORKERS` | `1` | API worker processes; raise it together with the service's memory |
| `PORT` | `8000` | Port the API listens on |

`worker` and `beat-worker` reference the same settings from `api` (`${{api.SECRET_KEY}}` and so on), so a change on `api` reaches them on their next deploy.

Plane's own defaults apply to everything not listed, for example `DEBUG=0`, `API_KEY_RATE_LIMIT=60/minute` and `FILE_SIZE_LIMIT=5242880` (5 MB) ([settings](https://github.com/makeplane/plane/blob/v1.4.3/apps/api/plane/settings/common.py)). To raise the upload limit, set `FILE_SIZE_LIMIT` in bytes on `api`, `worker` and `proxy`.

### `live`

| Variable | Value | What it is |
| --- | --- | --- |
| `API_BASE_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000` | API on the private network |
| `LIVE_SERVER_SECRET_KEY` | `${{api.LIVE_SERVER_SECRET_KEY}}` | Same secret as `api` |
| `REDIS_URL` | `${{plane-redis.REDIS_URL}}` | Valkey connection string |
| `PORT` | `3000` | Port the server listens on |

### `web`, `space`, `admin`

| Variable | Value | What it is |
| --- | --- | --- |
| `PORT` | `3000` | Port Plane's image serves on; Railway's healthcheck uses it |

### `proxy`

| Variable | Value | What it is |
| --- | --- | --- |
| `WEB_HOST`, `SPACE_HOST`, `ADMIN_HOST`, `LIVE_HOST`, `API_HOST`, `MINIO_HOST` | `${{<service>.RAILWAY_PRIVATE_DOMAIN}}` | Private hostname of each upstream |
| `PORT` | `80` | Port Caddy listens on; the public domain and the healthcheck use it |
| `BUCKET_NAME` | `${{api.AWS_S3_BUCKET_NAME}}` | Path routed to file storage |

### `plane-db`

| Variable | Value | What it is |
| --- | --- | --- |
| `POSTGRES_USER` | `plane` | Database user |
| `POSTGRES_PASSWORD` | generated, 32 chars | Database password |
| `POSTGRES_DB` | `plane` | Database name |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` | Data directory, one level inside the volume |
| `DATABASE_URL` | built from the values above | Connection string for the Plane services |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `60` | Time Postgres gets to shut down cleanly |

### `plane-redis`

| Variable | Value | What it is |
| --- | --- | --- |
| `VALKEY_PASSWORD` | generated, 32 chars | Valkey password |
| `REDIS_URL` | built from the values above | Connection string for the Plane services |

### `plane-mq`

| Variable | Value | What it is |
| --- | --- | --- |
| `RABBITMQ_DEFAULT_USER` | `plane` | Broker user |
| `RABBITMQ_DEFAULT_PASS` | generated, 32 chars | Broker password |
| `RABBITMQ_DEFAULT_VHOST` | `plane` | Virtual host |
| `RABBITMQ_NODENAME` | `rabbit@localhost` | Fixed node name, so the data directory survives redeploys |
| `AMQP_URL` | built from the values above | Connection string for the Plane services |

### `plane-minio`

| Variable | Value | What it is |
| --- | --- | --- |
| `MINIO_ROOT_USER` | generated, 20 chars | Storage access key |
| `MINIO_ROOT_PASSWORD` | generated, 40 chars | Storage secret key |
| `S3_ENDPOINT_URL` | `http://${{RAILWAY_PRIVATE_DOMAIN}}:9000` | Endpoint for the Plane services |

To turn on email (invites, magic links), sign in to `/god-mode` and fill in **Email** with your SMTP details. Plane stores them in its database, not in variables.

## Sizing and cost

Plane asks for at least 2 CPU cores and 4 GB of RAM, and 8 GB for production ([Plane: Docker Compose install](https://developers.plane.so/self-hosting/methods/docker-compose)). On Railway that is the sum over all twelve services, and you pay for what they use, not for a reserved size.

Railway's usage prices ([pricing](https://docs.railway.com/pricing/plans#resource-usage-pricing)):

| Resource | Price |
| --- | --- |
| Memory | $10 per GB per month |
| CPU | $20 per vCPU per month |
| Volume storage | $0.15 per GB per month |
| Network egress | $0.05 per GB |

What drives the bill:

- **Memory** is most of it. Twelve containers sit in memory all the time, even when nobody is using Plane. The Python services (`api`, `worker`, `beat-worker`) and the Node servers (`space`, `live`) use the most.
- **CPU** stays low when Plane is idle and rises with active users and background jobs.
- **Volumes** grow with your database and uploads. Backups are billed at the volume rate for the data unique to each backup.
- **Egress** is traffic served to browsers and API clients. Traffic between services on the private network is free.

The Hobby plan allows 5 GB per volume. Larger data needs the Pro plan ([plans](https://docs.railway.com/pricing/plans)).

## Backups and restore

Turn on daily and weekly backups for the `plane-db` and `plane-minio` volumes. [docs/backup-restore.md](docs/backup-restore.md) has the schedule commands, the restore procedure, and what a restore does to the other volumes.

## Upgrade Plane

1. Read the release notes for the new version at [github.com/makeplane/plane/releases](https://github.com/makeplane/plane/releases). Check for breaking changes and required steps.
2. Take a manual backup of `plane-db-data` and `plane-minio-data` ([how](docs/backup-restore.md#turn-on-scheduled-backups)).
3. Compare that release's `docker-compose.yml` with the previous one. New services, variables or image tags for Postgres, Valkey, RabbitMQ or storage have to be added here too.
4. In the Railway dashboard, change the image tag of `web`, `space`, `admin`, `live`, `api`, `worker` and `beat-worker` to the new version. If you deployed from your own fork, bump `PLANE` in `.railway/railway.ts` and the `FROM` tag in `proxy/Dockerfile` instead, and apply with `railway config apply`.
5. Deploy. `api` runs the new migrations before it starts.
6. Open Plane and check that your workspaces load.

This repository is updated for new Plane releases. A template deployment built from the `proxy` repository gets an update notice from Railway when the proxy changes ([template updates](https://docs.railway.com/templates/updates)).

## Deploy with infrastructure as code

The whole project is also described in [`.railway/railway.ts`](.railway/railway.ts), a [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) file. It is the definition this template is built from.

Requires the [Railway CLI](https://docs.railway.com/cli) and Node.js 22 or newer.

1. Fork this repository and point `github(...)` in `.railway/railway.ts` at your fork.
2. Set `REGION` in the same file to a region near you. Volumes cannot move later without being replaced.
3. Install the IaC SDK, create a project, then preview and apply:

   ```bash
   npm ci
   railway login
   railway init --name plane
   railway config plan
   railway config apply
   ```

Railway generates every `${{secret(...)}}` value on its side during the first apply, and keeps it on later applies of the same file. The proxy's public domain is created by the same apply.

Two things to know:

- `railway config plan` lists every plain variable as an update on every run, because the CLI cannot read stored values. A plan is clean when it creates and destroys nothing and changes no volume.
- Apply this file only to a project it created. If a variable already holds a different value, for example one you set by hand, applying `secret()` to it generates a new value. Postgres and RabbitMQ read their passwords only on first start, so a new password locks the services out of existing data.

## License

[AGPL-3.0](LICENSE). The Caddyfile in `proxy/` is derived from Plane's own proxy configuration, which is AGPL-3.0-only.

<sub>This is a community template. It is not affiliated with, endorsed by, or supported by Plane Software, Inc. Plane is a trademark of its owner.</sub>
