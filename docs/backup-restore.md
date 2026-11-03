# Backups and restore

Plane keeps its state on four Railway volumes. This page covers which ones to back up, how to schedule the backups, and how to restore one. It uses Railway's built-in [volume backups](https://docs.railway.com/volumes/backups).

| Volume | Service | Holds | Back up? |
| --- | --- | --- | --- |
| `plane-db-data` | `plane-db` | Postgres: every workspace, project, work item, page and user | Yes |
| `plane-minio-data` | `plane-minio` | Uploaded files and attachments | Yes |
| `plane-mq-data` | `plane-mq` | RabbitMQ queues of pending background jobs | Optional |
| `plane-redis-data` | `plane-redis` | Valkey cache and session data | Optional |

## How Railway backups work

A backup is an incremental, copy-on-write snapshot of one volume. Railway bills only the data unique to each backup, at the volume storage rate. Schedules and retention ([docs](https://docs.railway.com/volumes/backups#backup-schedules)):

- **Daily**: every 24 hours, kept for 6 days
- **Weekly**: every 7 days, kept for 27 days
- **Monthly**: every 30 days, kept for 89 days

A volume can have several schedules at once. Limits from the same page:

- A manual backup can hold at most 50% of the volume's size.
- Wiping a volume deletes its backups.
- A backup restores only into the same project and environment.

A snapshot of `plane-db-data` is crash-consistent. When Postgres starts on it, it replays its write-ahead log as it would after a power loss, which PostgreSQL documents as safe for atomic filesystem snapshots ([PostgreSQL: file system level backup](https://www.postgresql.org/docs/15/backup-file.html)). Each volume is snapshotted separately, so a database backup and an uploads backup are never from the same instant. A restore can then point at a file that the uploads backup does not have yet.

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

Run the mutation for the instance of `plane-db-data` and of `plane-minio-data`. The schedule needs the volume *instance* id; the id from `railway volume list` is the volume's own id and is refused. Templates and `.railway/railway.ts` do not carry backup schedules, so set them once per deployment.

Before an upgrade, take a manual backup of `plane-db-data` and `plane-minio-data` from the **Backups** tab with **Create backup**.

## Restore a backup

1. Open the service whose volume you are restoring, for example `plane-db`, and go to **Backups**.
2. Find the backup by its date and click **Restore**. Railway stages the change: it mounts a new volume, named after the backup date, at the same path. The current volume is unmounted and kept.
3. Click **Details** at the top of the canvas to review the staged change, then **Deploy**. The service redeploys on the restored data.
4. Check Plane: sign in and open a project you expect to see.
5. Give the volumes back the names `.railway/railway.ts` expects. Otherwise `railway config plan` reports the restored volume as a change. Rename the old volume first, then the restored one:

   ```bash
   railway volume update --volume plane-db-data --name plane-db-data-before-restore
   railway volume update --volume <restored-volume-name> --name plane-db-data
   ```

6. When you no longer need the old volume, delete it. Backups newer than the restored one live only on that old volume.

Restoring `plane-db-data` rolls back everything in Plane to the backup time. Restore `plane-minio-data` from the closest backup after it, so files uploaded before the database backup are still there.
