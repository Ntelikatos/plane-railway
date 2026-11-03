# Plane Community Edition on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/plane-community-edition?utm_medium=integration&utm_source=button&utm_campaign=plane-ce)
[![Validate Config](https://github.com/Ntelikatos/plane-railway/actions/workflows/validate.yml/badge.svg)](https://github.com/Ntelikatos/plane-railway/actions/workflows/validate.yml)

Self-host [Plane](https://plane.so), the open-source project management tool, on Railway in one click. This template runs Plane Community Edition **v1.4.3** from Plane's official Docker Compose setup. Every password is generated for you, the data sits on Railway volumes, and you get one HTTPS address.

Community Edition is Plane's free AGPL-3.0 edition: work items, cycles, modules, pages, intake, estimates, the REST API and webhooks, with no user limit. Integrations such as GitHub and Slack, custom properties, epics and the wiki come only with Plane's paid editions ([plane.so/open-source](https://plane.so/open-source)).

## Get started

1. Click **Deploy on Railway** above, then **Deploy**. There is nothing to fill in.
2. Wait until all twelve services are online. The first deploy takes a few minutes.
3. Open the public URL of the `proxy` service and click **Get started**.
   Do this straight away. Until you create the admin account, anyone who finds the URL can create it instead.
4. Fill in the setup form (name, email, company name, password) and click **Continue**. This creates the admin account for your Plane instance.
5. Click **Create workspace** in the popup. Give your workspace a name and a team size, then click **Create workspace**.
6. Open **Authentication** in the admin menu and turn off **Allow anyone to sign up even without an invite**. Now only people you invite can join.
7. Go to your Plane URL, sign in with the same email and password, and confirm your name.
8. Close the welcome popup with **No thanks**. You are now on your Plane dashboard.

The admin pages stay at `/god-mode` on your Plane URL.

## What runs

| Service | What it does |
| --- | --- |
| `proxy` | The only public service. Sends each request to the right service below |
| `web` | The Plane app |
| `space` | Public pages for projects you publish |
| `admin` | The admin pages at `/god-mode` |
| `live` | Live editing of pages |
| `api` | Plane's API. It updates the database before each deploy |
| `worker`, `beat-worker` | Background and scheduled jobs |
| `plane-db` | Postgres 15, the database |
| `plane-redis` | Valkey, the cache |
| `plane-mq` | RabbitMQ, the job queue |
| `plane-minio` | File storage for uploads |

The four data services keep their data on Railway volumes. Every image is pinned to the tag in Plane's compose file for this release. [docs/architecture.md](docs/architecture.md) explains how the compose file maps to Railway.

## Settings you may want to change

You don't need to change any variable. These are the ones people change most. All of them are listed in [docs/variables.md](docs/variables.md).

- **Your own domain.** Add it to the `proxy` service under **Settings > Networking**. Then redeploy `api`, `worker` and `beat-worker`, so Plane uses the new address in its links.
- **Bigger uploads.** The upload limit is 5 MB. To raise it, set `FILE_SIZE_LIMIT` in bytes on `api`, `worker` and `proxy`.
- **More API capacity.** Raise `GUNICORN_WORKERS` on `api`. Each extra process uses more memory.
- **Faster background jobs.** Raise `WORKER_CONCURRENCY` on `worker` (2 by default). Each extra process uses more memory. Without this setting, the worker starts one process per CPU that Railway shows it. In our test that was 48 processes and about 3.7 GB.
- **Email.** Plane needs SMTP to send invites and sign-in codes. Set it up in the admin pages under **Email**. Plane keeps these settings in its database, not in variables.

## Cost

Railway bills for what the services use, not for a fixed size ([pricing](https://docs.railway.com/pricing/plans#resource-usage-pricing)):

| Resource | Price |
| --- | --- |
| Memory | $10 per GB per month |
| CPU | $20 per vCPU per month |
| Volume storage | $0.15 per GB per month |
| Network egress | $0.05 per GB |

Memory is most of the bill. All twelve services run all the time, even when nobody uses Plane. CPU stays low when Plane is idle. Volumes grow with your data and uploads. Traffic between the services is free.

On the Hobby plan a volume holds at most 5 GB. Larger data needs the Pro plan ([plans](https://docs.railway.com/pricing/plans)).

## Backups

Turn on daily and weekly backups for the `plane-db` and `plane-minio` volumes. [docs/backup-restore.md](docs/backup-restore.md) shows how, and how to restore one.

## Upgrade Plane

Railway can't update image versions in a deployed template for you, so an upgrade is done by hand:

1. Read the release notes at [github.com/makeplane/plane/releases](https://github.com/makeplane/plane/releases) for breaking changes.
2. Take a manual backup of `plane-db` and `plane-minio` ([how](docs/backup-restore.md#turn-on-scheduled-backups)).
3. Change the image tag to the new version on `web`, `space`, `admin`, `live`, `api`, `worker` and `beat-worker`.
4. Deploy. `api` updates the database before it starts.
5. Open Plane and check that your workspaces load.

Railway may also offer an update for the `proxy` service when this repository changes ([template updates](https://docs.railway.com/templates/updates)). Accept it together with the image tags for the same Plane version, never on its own. Watch this repository's releases to see which version each change is for.

## Deploy with infrastructure as code

The whole project is also described in [`.railway/railway.ts`](.railway/railway.ts), a [Railway infrastructure as code](https://docs.railway.com/infrastructure-as-code) file. The template is built from it. This route needs the [Railway CLI](https://docs.railway.com/cli) and Node.js 24.

1. Fork this repository and point `github(...)` in `.railway/railway.ts` at your fork.
2. Set `REGION` in the same file to a region near you. A volume can't move later without being replaced.
3. Install, create a project, then preview and apply:

   ```bash
   npm ci
   railway login
   railway init --name plane
   railway config plan
   railway config apply
   ```

Railway creates every `${{secret(...)}}` value during the first apply and keeps it on later applies. Two things to know:

- `railway config plan` lists every plain variable as a change on every run, because the CLI can't read stored values. A plan is fine when it creates and destroys nothing and leaves volumes alone.
- Apply this file only to a project it created. Applying it over a variable you set by hand creates a new password, and Postgres and RabbitMQ then can't open their existing data.

## License

[AGPL-3.0](LICENSE). The Caddyfile in `proxy/` comes from Plane's own proxy setup, which is AGPL-3.0-only.

<sub>This is a community template. It is not affiliated with, endorsed by, or supported by Plane Software, Inc. Plane is a trademark of its owner.</sub>
