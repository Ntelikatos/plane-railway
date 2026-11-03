# Test report

The template as published, deployed into a throwaway Railway project on a Pro
workspace, with nothing filled in at deploy time. Plane Community Edition
v1.4.3. Each check lists what was done and what came back.

## Deploy

- All twelve services reached SUCCESS about three minutes after the deploy started, and the canvas showed each one as "Online".
- The proxy's public URL served the app (`/`), the admin pages (`/god-mode/`), public pages (`/spaces/`), live editing (`/live/health`) and the API (`/api/instances/`), all with HTTP 200.

## First run

- Before anyone visited, `/api/instances/` reported setup not done. Anyone with the URL could have created the admin, which is why the README's step 3 says to do it straight away.
- The README's Get started path worked as written, from **Get started** to the workspace home. Screenshots of each screen were taken along the way.
- Open sign-up was on by default. After turning it off in **Authentication**, `/api/instances/` reported `enable_signup: false`.

## REST API

With a personal access token created in Plane (Profile settings > Personal Access Tokens), sent as `X-API-Key`:

| Call | Result |
| --- | --- |
| `GET /api/v1/users/me/` | 200 |
| `POST /api/v1/workspaces/<slug>/projects/` | 201 |
| `POST .../projects/<id>/work-items/` twice (A and B) | 201, 201 |
| `POST .../work-items/<A>/relations/` with `{"relation_type": "blocked_by", "issues": ["<B>"]}` | 201 |
| `GET .../work-items/<A>/relations/` | 200, `blocked_by` lists B |
| `GET .../work-items/<B>/relations/` | 200, `blocking` lists A |

The relations endpoint is part of Community Edition: `apps/api/plane/api/urls/work_item.py` at tag v1.4.3 routes GET and POST to it.

## MCP server

`makeplane/plane-mcp-server` 0.3.5 over stdio (`uvx plane-mcp-server@0.3.5 stdio`), with `PLANE_BASE_URL` set to the deploy:

| Tool call | Result |
| --- | --- |
| `project` `{"action": "list"}` | ok, lists the test project |
| `workitem` `{"action": "create", ...}` | ok, work item created |
| `workitem` `{"action": "list", ...}` | ok, the new item is listed |

The server also uses Plane's API v2 for some tools. Community Edition v1.4.3 has no v2 (`/api/v2/...` returns 404), so tools outside projects and work items may not work.

## Redeploys

- **RabbitMQ.** The first boot logged "Will seed default virtual host and user" with 0 queues. After a redeploy it used the same data folder (`rabbit@localhost`), seeded nothing and logged "Recovering 1 queues". The worker reconnected 14 seconds after the restart. `RABBITMQ_NODENAME` does its job.
- **API.** After a redeploy, `/api/instances/` showed the same instance id with setup done, and the API token still worked.

## Uploads

An attachment upload through Plane's own flow:

- the presigned upload URL was `https://<public domain>/uploads`;
- the upload to it returned 204;
- the download link redirected to `https://<public domain>/uploads/...` and returned the file.

`MINIO_ENDPOINT_SSL=1` gives https links as intended.

## Proxy and client addresses

A request with a spoofed `X-Forwarded-For: 203.0.113.77` was logged by Plane with the caller's real address. Railway's edge sets the header, so the proxy's `trusted_proxies 0.0.0.0/0` (from Plane's own Caddyfile) does not let clients fake their address.

## Own domain

Adding a custom domain to `proxy` switched `RAILWAY_PUBLIC_DOMAIN` to it straight away, and `WEB_URL` and `CORS_ALLOWED_ORIGINS` on `api` followed. The generated domain kept working. Removing the domain switched them back. This matches the README: add the domain, then redeploy `api`, `worker` and `beat-worker`.

## Backups and restore

Following [backup-restore.md](backup-restore.md):

1. `volumeInstanceBackupScheduleUpdate` with `[DAILY, WEEKLY]` on the `plane-db` and `plane-minio` volumes; the schedule list showed both kinds on each.
2. With three work items in the test project, a manual backup of the `plane-db` volume.
3. A fourth work item, created after the backup.
4. **Restore** on the backup, then **Deploy Changes**. Railway mounted a new volume named after the backup time and kept the old one.
5. Postgres logged `automatic recovery in progress`, then `ready to accept connections`.
6. The project listed the three original work items; the fourth was gone. The instance and the API token still worked.
7. The doc's two `railway volume update` renames worked, and the schedules were on the restored volume.

The test also corrected the doc: the dashboard button is **New backup**, and template deploys name volumes after their service (`plane-db-volume`).

## Memory, CPU and cost

Railway's `metrics` query, grouped by service, five-minute samples, with the
project idle apart from the tests above. Monthly figures price the averages at
the [list rates](https://docs.railway.com/pricing/plans#resource-usage-pricing).

| Window | Memory avg | CPU avg | Volumes | Per month |
| --- | --- | --- | --- | --- |
| 11 hours, worker unbounded | 4.78 GB | 0.016 vCPU | 6.4 GB | $49.02 |
| 43 minutes, `WORKER_CONCURRENCY=2` | 1.31 GB | 0.010 vCPU | 4.6 GB | $14.03 |

The worker caused the difference. Plane's worker runs `celery worker` with no
pool size, and Celery sizes the pool by the CPUs it sees. On Railway that is
the host's CPUs: the startup banner listed 48 processes and the worker held
3.72 GB on its own. With the pool fixed at 2 it holds 0.26 GB, and a work
item's background task still ran in the same second it was created.

Every other service stayed between 0.006 GB (admin) and 0.18 GB (RabbitMQ).
The volume figure dropped because the restore test left a detached copy of
the database volume in the first window. Egress was under 0.01 GB.

The second window is short: it ends when the test project was deleted. The
services' memory was flat across it (the largest gap between average and
peak is 0.02 GB), so a longer idle window is not expected to differ much.
Real use adds CPU and memory on `api` and `worker`.
