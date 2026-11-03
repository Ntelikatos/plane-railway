# Deploy and Host Plane Community Edition with Railway

Plane is an open-source project management tool. It has work items, cycles, modules, pages, intake and estimates, plus a REST API and webhooks. This template runs Plane Community Edition, the free AGPL-3.0 edition, with no user limit.

## About Hosting Plane Community Edition

This template runs Plane's official Docker Compose setup on Railway, one service per container. It uses Plane's own pinned images for the app, the API, the background jobs, live editing, the admin pages and public pages. Postgres, Valkey, RabbitMQ and file storage come from the same setup, each with a Railway volume. Every password is generated when you deploy, so there is nothing to fill in. The services talk over Railway's private network, and only the proxy is public. You get one HTTPS address, and you create the admin account on it.

## Common Use Cases

- Project management for a team, without paying per seat
- A self-hosted alternative to Jira or Linear, with your data in your own Railway project
- Work items created and updated by scripts, CI or AI agents through the REST API
- Specs and notes kept next to the work, in Plane pages

## Dependencies for Plane Community Edition Hosting

- **Postgres 15**: the database
- **Valkey**: the cache
- **RabbitMQ**: the queue for background jobs
- **S3-compatible file storage**: uploads and attachments

### Deployment Dependencies

- [Plane self-hosting docs](https://developers.plane.so/self-hosting/overview)
- [Plane on GitHub](https://github.com/makeplane/plane)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
- [Source code of this template](https://github.com/Ntelikatos/plane-railway)

### Implementation Details

After the deploy:

1. Wait until all twelve services are online, then open the public URL of the `proxy` service.
2. Click **Get started** and create the admin account straight away. Until you do, anyone who finds the URL can create it instead.
3. Create your workspace in the popup.
4. Open **Authentication** in the admin menu and turn off **Allow anyone to sign up even without an invite**.
5. Go to your Plane URL and sign in with the same email and password.

Turn on daily backups for the `plane-db` and `plane-minio` volumes in each service's **Backups** tab.

### Why Deploy Plane Community Edition on Railway?

Railway runs all twelve services, their volumes and backups in one project, with no servers to manage. You pay for what Plane uses, and you can give any service more resources when your team grows.

---

<sub>This is a community template. It is not affiliated with, endorsed by, or supported by Plane Software, Inc. Plane is a trademark of its owner.</sub>
