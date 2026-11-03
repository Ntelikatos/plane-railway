# Backups and restore

Plane keeps its state on four Railway volumes. This page covers which ones to back up, how to schedule the backups, and how to restore one. It uses Railway's built-in [volume backups](https://docs.railway.com/volumes/backups).

A deploy from the template names each volume after its service, such as `plane-db-volume`. A deploy from `.railway/railway.ts` uses the names in that file, such as `plane-db-data`. This page calls each volume by its service.

| Service | Volume holds | Back up? |
| --- | --- | --- |
| `plane-db` | Postgres: every workspace, project, work item, page and user | Yes |
| `plane-minio` | Uploaded files and attachments | Yes |
| `plane-mq` | RabbitMQ queues of pending background jobs | Optional |
| `plane-redis` | Valkey cache and session data | Optional |

## How Railway backups work

A backup is an incremental, copy-on-write snapshot of one volume. Railway bills only the data unique to each backup, at the volume storage rate. Schedules and retention ([docs](https://docs.railway.com/volumes/backups#backup-schedules)):

- **Daily**: every 24 hours, kept for 6 days
- **Weekly**: every 7 days, kept for 27 days
- **Monthly**: every 30 days, kept for 89 days

A volume can have several schedules at once. Limits from the same page:

- A manual backup can hold at most 50% of the volume's size.
- Wiping a volume deletes its backups.
- A backup restores only into the same project and environment.

A snapshot of the `plane-db` volume is crash-consistent. When Postgres starts on it, it replays its write-ahead log as it would after a power loss, which PostgreSQL documents as safe for atomic filesystem snapshots ([PostgreSQL: file system level backup](https://www.postgresql.org/docs/15/backup-file.html)). Each volume is snapshotted separately, so a database backup and an uploads backup are never from the same instant. A restore can then point at a file that the uploads backup does not have yet.

## Turn on scheduled backups

In the Railway dashboard, open each service with a volume to back up (`plane-db` and `plane-minio` at least), go to the **Backups** tab, and tick **Daily** and **Weekly**.

The same setting from the command line, with the [Railway CLI](https://docs.railway.com/cli) logged in and linked to the project:

```bash
# List each volume with its volume instance id (railway status --json shows the project id)
railway api 'query($p: String!) { project(id: $p) { volumes { edges { node { name volumeInstances { edges { node { id } } } } } } } }' --raw-var p=<project-id>

# Daily and weekly backups for one volume instance
railway api 'mutation($id: String!) { volumeInstanceBackupScheduleUpdate(volumeInstanceId: $id, kinds: [DAILY, WEEKLY]) }' --raw-var id=<volume-instance-id>

# Check the schedule
railway api 'query($id: String!) { volumeInstanceBackupScheduleList(volumeInstanceId: $id) { kind cron } }' --raw-var id=<volume-instance-id>
```

Run the mutation for the volume instance of `plane-db` and of `plane-minio`. The schedule needs the volume *instance* id; the id from `railway volume list` is the volume's own id and is refused. Templates and `.railway/railway.ts` do not carry backup schedules, so set them once per deployment.

Before an upgrade, take a manual backup of the `plane-db` and `plane-minio` volumes from each service's **Backups** tab with **New backup**.

## Restore a backup

1. Open the service whose volume you are restoring, for example `plane-db`, and go to **Backups**.
2. Find the backup by its date and click **Restore**, then **Restore** again in the dialog. Railway stages the change: it mounts a new volume, named after the service and the backup time (for example `plane-db-2026-01-31 03:00 UTC`), at the same path. The current volume is unmounted and kept. The backup schedules carry over to the new volume.
3. Click **Details** at the top of the canvas to review the staged change, then **Deploy Changes**. The service redeploys on the restored data. Postgres logs `automatic recovery in progress` while it replays its write-ahead log, then `ready to accept connections`.
4. Check Plane: sign in and open a project you expect to see.
5. Rename the volumes, so the restored one has the old name back. For a deploy from `.railway/railway.ts` this matters: otherwise `railway config plan` reports the restored volume as a change. Rename the old volume first, then the restored one. The names below are for an IaC deploy; a template deploy uses `plane-db-volume`.

   ```bash
   railway volume update --volume plane-db-data --name plane-db-data-before-restore
   railway volume update --volume <restored-volume-name> --name plane-db-data
   ```

6. When you no longer need the old volume, delete it. Backups newer than the restored one live only on that old volume.

Restoring the `plane-db` volume rolls back everything in Plane to the backup time. Restore the `plane-minio` volume from the closest backup after it, so files uploaded before the database backup are still there.
