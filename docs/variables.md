# Variables

The template sets every variable, so a deploy needs no input. This page lists them all, by service. Values marked **generated** are random. Railway creates them when you deploy, and they are never stored in this repository.

`worker` and `beat-worker` copy their settings from `api`, so a change on `api` reaches them on their next deploy.

## proxy

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `80` | Port the proxy listens on. Your public domain points here |
| `BUCKET_NAME` | `${{api.AWS_S3_BUCKET_NAME}}` | Folder for uploaded files, from api |
| `WEB_HOST` | `${{web.RAILWAY_PRIVATE_DOMAIN}}` | Private address of web |
| `SPACE_HOST` | `${{space.RAILWAY_PRIVATE_DOMAIN}}` | Private address of space |
| `ADMIN_HOST` | `${{admin.RAILWAY_PRIVATE_DOMAIN}}` | Private address of admin |
| `LIVE_HOST` | `${{live.RAILWAY_PRIVATE_DOMAIN}}` | Private address of live |
| `API_HOST` | `${{api.RAILWAY_PRIVATE_DOMAIN}}` | Private address of api |
| `MINIO_HOST` | `${{plane-minio.RAILWAY_PRIVATE_DOMAIN}}` | Private address of plane-minio |

## web

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port this service listens on. Railway checks its health here |

## space

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port this service listens on. Railway checks its health here |

## admin

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port this service listens on. Railway checks its health here |

## live

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port the live service listens on |
| `API_BASE_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000` | API address on the private network |
| `LIVE_SERVER_SECRET_KEY` | `${{api.LIVE_SERVER_SECRET_KEY}}` | Same as LIVE_SERVER_SECRET_KEY on api |
| `REDIS_URL` | `${{plane-redis.REDIS_URL}}` | Cache address, from plane-redis |

## api

| Variable | Value | What it does |
| --- | --- | --- |
| `PORT` | `8000` | Port the API listens on |
| `GUNICORN_WORKERS` | `1` | Number of API processes. More handle more users and use more memory |
| `SECRET_KEY` | generated, 50 characters | Key Plane signs sessions with. Railway creates it when you deploy |
| `LIVE_SERVER_SECRET_KEY` | generated, 64 hex characters | Key shared with the live service. Railway creates it when you deploy |
| `WEB_URL` | `https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}` | Your Plane address. It follows the proxy's public domain |
| `CORS_ALLOWED_ORIGINS` | `https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}` | Sites allowed to call the API. Same as your Plane address |
| `DATABASE_URL` | `${{plane-db.DATABASE_URL}}` | Database address, from plane-db |
| `REDIS_URL` | `${{plane-redis.REDIS_URL}}` | Cache address, from plane-redis |
| `AMQP_URL` | `${{plane-mq.AMQP_URL}}` | Queue address, from plane-mq |
| `USE_MINIO` | `1` | Keep uploads in the bundled file storage |
| `MINIO_ENDPOINT_SSL` | `1` | Make upload links use https, as Railway serves only https |
| `AWS_ACCESS_KEY_ID` | `${{plane-minio.MINIO_ROOT_USER}}` | File storage access key, from plane-minio |
| `AWS_SECRET_ACCESS_KEY` | `${{plane-minio.MINIO_ROOT_PASSWORD}}` | File storage secret key, from plane-minio |
| `AWS_S3_ENDPOINT_URL` | `${{plane-minio.S3_ENDPOINT_URL}}` | File storage address, from plane-minio |
| `AWS_S3_BUCKET_NAME` | `uploads` | Folder for uploaded files. Plane creates it on first start |

## worker

| Variable | Value | What it does |
| --- | --- | --- |
| `SECRET_KEY` | `${{api.SECRET_KEY}}` | Same as SECRET_KEY on api |
| `LIVE_SERVER_SECRET_KEY` | `${{api.LIVE_SERVER_SECRET_KEY}}` | Same as LIVE_SERVER_SECRET_KEY on api |
| `WEB_URL` | `${{api.WEB_URL}}` | Same as WEB_URL on api |
| `CORS_ALLOWED_ORIGINS` | `${{api.CORS_ALLOWED_ORIGINS}}` | Same as CORS_ALLOWED_ORIGINS on api |
| `DATABASE_URL` | `${{api.DATABASE_URL}}` | Same as DATABASE_URL on api |
| `REDIS_URL` | `${{api.REDIS_URL}}` | Same as REDIS_URL on api |
| `AMQP_URL` | `${{api.AMQP_URL}}` | Same as AMQP_URL on api |
| `USE_MINIO` | `${{api.USE_MINIO}}` | Same as USE_MINIO on api |
| `MINIO_ENDPOINT_SSL` | `${{api.MINIO_ENDPOINT_SSL}}` | Same as MINIO_ENDPOINT_SSL on api |
| `AWS_ACCESS_KEY_ID` | `${{api.AWS_ACCESS_KEY_ID}}` | Same as AWS_ACCESS_KEY_ID on api |
| `AWS_SECRET_ACCESS_KEY` | `${{api.AWS_SECRET_ACCESS_KEY}}` | Same as AWS_SECRET_ACCESS_KEY on api |
| `AWS_S3_ENDPOINT_URL` | `${{api.AWS_S3_ENDPOINT_URL}}` | Same as AWS_S3_ENDPOINT_URL on api |
| `AWS_S3_BUCKET_NAME` | `${{api.AWS_S3_BUCKET_NAME}}` | Same as AWS_S3_BUCKET_NAME on api |
| `WORKER_CONCURRENCY` | `2` | Number of background job processes. More run more jobs at once and use more memory |

## beat-worker

| Variable | Value | What it does |
| --- | --- | --- |
| `SECRET_KEY` | `${{api.SECRET_KEY}}` | Same as SECRET_KEY on api |
| `LIVE_SERVER_SECRET_KEY` | `${{api.LIVE_SERVER_SECRET_KEY}}` | Same as LIVE_SERVER_SECRET_KEY on api |
| `WEB_URL` | `${{api.WEB_URL}}` | Same as WEB_URL on api |
| `CORS_ALLOWED_ORIGINS` | `${{api.CORS_ALLOWED_ORIGINS}}` | Same as CORS_ALLOWED_ORIGINS on api |
| `DATABASE_URL` | `${{api.DATABASE_URL}}` | Same as DATABASE_URL on api |
| `REDIS_URL` | `${{api.REDIS_URL}}` | Same as REDIS_URL on api |
| `AMQP_URL` | `${{api.AMQP_URL}}` | Same as AMQP_URL on api |
| `USE_MINIO` | `${{api.USE_MINIO}}` | Same as USE_MINIO on api |
| `MINIO_ENDPOINT_SSL` | `${{api.MINIO_ENDPOINT_SSL}}` | Same as MINIO_ENDPOINT_SSL on api |
| `AWS_ACCESS_KEY_ID` | `${{api.AWS_ACCESS_KEY_ID}}` | Same as AWS_ACCESS_KEY_ID on api |
| `AWS_SECRET_ACCESS_KEY` | `${{api.AWS_SECRET_ACCESS_KEY}}` | Same as AWS_SECRET_ACCESS_KEY on api |
| `AWS_S3_ENDPOINT_URL` | `${{api.AWS_S3_ENDPOINT_URL}}` | Same as AWS_S3_ENDPOINT_URL on api |
| `AWS_S3_BUCKET_NAME` | `${{api.AWS_S3_BUCKET_NAME}}` | Same as AWS_S3_BUCKET_NAME on api |

## plane-db

| Variable | Value | What it does |
| --- | --- | --- |
| `POSTGRES_USER` | `plane` | Database user name |
| `POSTGRES_DB` | `plane` | Database name |
| `POSTGRES_PASSWORD` | generated, 32 characters | Database password. Railway creates it when you deploy |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` | Folder in the volume where Postgres keeps its data |
| `DATABASE_URL` | `postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}` | Address the Plane services use to reach the database |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `60` | Seconds Postgres gets to shut down safely |

## plane-redis

| Variable | Value | What it does |
| --- | --- | --- |
| `VALKEY_PASSWORD` | generated, 32 characters | Cache password. Railway creates it when you deploy |
| `REDIS_URL` | `redis://default:${{VALKEY_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/` | Address the Plane services use to reach the cache |

## plane-mq

| Variable | Value | What it does |
| --- | --- | --- |
| `RABBITMQ_DEFAULT_USER` | `plane` | Queue user name |
| `RABBITMQ_DEFAULT_PASS` | generated, 32 characters | Queue password. Railway creates it when you deploy |
| `RABBITMQ_DEFAULT_VHOST` | `plane` | Queue namespace for Plane |
| `RABBITMQ_NODENAME` | `rabbit@localhost` | Fixed name, so queued jobs survive a redeploy |
| `AMQP_URL` | `amqp://${{RABBITMQ_DEFAULT_USER}}:${{RABBITMQ_DEFAULT_PASS}}@${{RAILWAY_PRIVATE_DOMAIN}}:5672/${{RABBITMQ_DEFAULT_VHOST}}` | Address the Plane services use to reach the queue |

## plane-minio

| Variable | Value | What it does |
| --- | --- | --- |
| `MINIO_ROOT_USER` | generated, 20 characters | File storage access key. Railway creates it when you deploy |
| `MINIO_ROOT_PASSWORD` | generated, 40 characters | File storage secret key. Railway creates it when you deploy |
| `S3_ENDPOINT_URL` | `http://${{RAILWAY_PRIVATE_DOMAIN}}:9000` | Address the Plane services use to reach file storage |

Plane's own defaults cover everything not listed, for example `FILE_SIZE_LIMIT=5242880` (5 MB) and `API_KEY_RATE_LIMIT=60/minute` ([settings](https://github.com/makeplane/plane/blob/v1.4.3/apps/api/plane/settings/common.py)).
