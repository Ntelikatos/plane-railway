# Deploy and Host Plane Community Edition with Railway

Plane is an open-source project management tool: work items, cycles, modules, pages, intake and estimates, with a REST API and webhooks. This template runs Plane Community Edition, the AGPL-3.0 edition, as one Railway project with a database, a queue, file storage and one public HTTPS domain.

## About Hosting Plane Community Edition

Plane's official self-hosted setup is a Docker Compose file of twelve containers. This template translates that file service by service. You get Plane's own pinned images for the web app, the API, the background workers, the real-time server, the admin panel and the public pages. Postgres, Valkey, RabbitMQ and S3-compatible storage come from the same compose file, each on a Railway volume. Every password and key is generated when you deploy, and the services talk over Railway's private network. Only the proxy is public. Open the domain and create the first admin account at `/god-mode`.

## Common Use Cases

- **Team project management**: work items, cycles and modules for a software team, without a per-seat licence
- **A self-hosted alternative to Jira or Linear**: your data stays in your own Railway project
- **Automation over the REST API**: create and update work items from scripts, CI or AI agents with an API token
- **Docs next to the work**: Plane pages for specs and notes in the same workspace

## Dependencies for Plane Community Edition Hosting

- **Postgres 15**: Plane's main database
- **Valkey**: cache and sessions
- **RabbitMQ**: queue for Plane's background workers
- **MinIO-compatible object storage**: uploaded files and attachments

### Deployment Dependencies

- [Plane self-hosting docs](https://developers.plane.so/self-hosting/overview)
- [Plane on GitHub](https://github.com/makeplane/plane)
- [Railway volumes](https://docs.railway.com/volumes) and [volume backups](https://docs.railway.com/volumes/backups)
- [Source code of this template on GitHub](https://github.com/Ntelikatos/plane-railway)

### Implementation Details

After the deploy finishes, open the `proxy` service's public domain:

1. Go to `https://<your-domain>/god-mode` and create the instance admin account.
2. Go to `https://<your-domain>` and create your first workspace.
3. For API access, create a token under **Profile settings > Personal access tokens** and send it in the `X-API-Key` header to `https://<your-domain>/api/v1/`.

Plan for at least 4 GB of RAM in total across the services. Plane recommends 2 CPU cores and 4 GB of RAM, and 8 GB for production. Turn on daily backups for the `plane-db` and `plane-minio` volumes in each service's **Backups** tab.

### Why Deploy Plane Community Edition on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Plane Community Edition on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

---

<sub>This is a community template. It is not affiliated with, endorsed by, or supported by Plane Software, Inc. Plane is a trademark of its owner.</sub>
