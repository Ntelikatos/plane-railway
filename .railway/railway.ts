import { defineRailway, github, image, project, service, volume } from "railway/iac";

// Plane Community Edition, translated service by service from the official
// Docker Compose file of the release below:
// https://github.com/makeplane/plane/releases/download/v1.4.3/docker-compose.yml
// Upgrading Plane means bumping this tag and the one in proxy/Dockerfile, and
// taking any new image pins from that release's compose file.
const PLANE = "v1.4.3";

// Region for every service and volume; a service and its volume must share
// one. Pick a region near you before the first apply: moving a volume later
// is destructive. A template deploy ignores this and uses the deployer's
// choice. https://docs.railway.com/deployments/regions
const REGION = "us-west2";
// 5 GB is the most a Hobby volume can hold. Raising it later is non-destructive.
// https://docs.railway.com/pricing/plans
const VOLUME_MB = 5000;

// Railway runs a start command in exec form instead of the image ENTRYPOINT
// (https://docs.railway.com/deployments/start-command), so the commands below
// call the entrypoint explicitly wherever the compose file relied on it.

// A secret Railway generates on its side, on the first apply or template
// deploy. The value never exists in this repository.
// https://docs.railway.com/templates/create#template-variable-functions
const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const secret = (length: number, alphabet = ALNUM) => `\${{secret(${length}, "${alphabet}")}}`;

// A variable with the description the template shows for it. Railway stores
// only the value; scripts/template.mjs reads the description.
const v = (value: string, description: string) => ({ value, description });

const vol = (name: string) => volume(name, { region: REGION, sizeMB: VOLUME_MB });
const pgdata = vol("plane-db-data");
const redisdata = vol("plane-redis-data");
const mqdata = vol("plane-mq-data");
const uploads = vol("plane-minio-data");

const replicas = { [REGION]: 1 };

const db = service("plane-db", {
  source: image("postgres:15.7-alpine"),
  start: "docker-entrypoint.sh postgres -c max_connections=1000",
  replicas,
  volumeMounts: { "/var/lib/postgresql/data": pgdata },
  env: {
    POSTGRES_USER: v("plane", "Database user name"),
    POSTGRES_DB: v("plane", "Database name"),
    POSTGRES_PASSWORD: v(secret(32), "Database password. Railway creates it when you deploy"),
    // A Railway volume has lost+found at its root, which initdb refuses.
    PGDATA: v("/var/lib/postgresql/data/pgdata", "Folder in the volume where Postgres keeps its data"),
    DATABASE_URL: v(
      "postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}",
      "Address the Plane services use to reach the database",
    ),
    RAILWAY_DEPLOYMENT_DRAINING_SECONDS: v("60", "Seconds Postgres gets to shut down safely"),
  },
});

const redis = service("plane-redis", {
  source: image("valkey/valkey:7.2.11-alpine"),
  start: `/bin/sh -c 'exec docker-entrypoint.sh valkey-server --requirepass "$VALKEY_PASSWORD"'`,
  replicas,
  volumeMounts: { "/data": redisdata },
  env: {
    VALKEY_PASSWORD: v(secret(32), "Cache password. Railway creates it when you deploy"),
    REDIS_URL: v(
      "redis://default:${{VALKEY_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/",
      "Address the Plane services use to reach the cache",
    ),
  },
});

const mq = service("plane-mq", {
  source: image("rabbitmq:3.13.6-management-alpine"),
  replicas,
  volumeMounts: { "/var/lib/rabbitmq": mqdata },
  env: {
    RABBITMQ_DEFAULT_USER: v("plane", "Queue user name"),
    RABBITMQ_DEFAULT_PASS: v(secret(32), "Queue password. Railway creates it when you deploy"),
    RABBITMQ_DEFAULT_VHOST: v("plane", "Queue namespace for Plane"),
    // RabbitMQ keys its data directory by node name, which defaults to the
    // container hostname. Railway changes the hostname on every deploy.
    RABBITMQ_NODENAME: v("rabbit@localhost", "Fixed name, so queued jobs survive a redeploy"),
    AMQP_URL: v(
      "amqp://${{RABBITMQ_DEFAULT_USER}}:${{RABBITMQ_DEFAULT_PASS}}@${{RAILWAY_PRIVATE_DOMAIN}}:5672/${{RABBITMQ_DEFAULT_VHOST}}",
      "Address the Plane services use to reach the queue",
    ),
  },
});

const minio = service("plane-minio", {
  source: image("pgsty/silo:RELEASE.2026-09-16T00-00-00Z"),
  start: '/usr/bin/docker-entrypoint.sh server /export --console-address ":9090"',
  replicas,
  volumeMounts: { "/export": uploads },
  env: {
    MINIO_ROOT_USER: v(secret(20), "File storage access key. Railway creates it when you deploy"),
    MINIO_ROOT_PASSWORD: v(secret(40), "File storage secret key. Railway creates it when you deploy"),
    S3_ENDPOINT_URL: v("http://${{RAILWAY_PRIVATE_DOMAIN}}:9000", "Address the Plane services use to reach file storage"),
  },
});

// Settings Plane's code does not default the way this deploy needs. DEBUG,
// API_KEY_RATE_LIMIT, FILE_SIZE_LIMIT and AWS_REGION are left to Plane's
// defaults (apps/api/plane/settings/common.py).
const api = service("api", {
  source: image(`makeplane/plane-backend:${PLANE}`),
  // The compose file's one-shot migrator service.
  // https://docs.railway.com/deployments/pre-deploy-command
  preDeploy: "./bin/docker-entrypoint-migrator.sh",
  start: "./bin/docker-entrypoint-api.sh",
  healthcheck: "/",
  replicas,
  env: {
    PORT: v("8000", "Port the API listens on"),
    GUNICORN_WORKERS: v("1", "Number of API processes. More handle more users and use more memory"),
    SECRET_KEY: v(secret(50), "Key Plane signs sessions with. Railway creates it when you deploy"),
    LIVE_SERVER_SECRET_KEY: v(secret(64, "abcdef0123456789"), "Key shared with the live service. Railway creates it when you deploy"),
    WEB_URL: v("https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}", "Your Plane address. It follows the proxy's public domain"),
    CORS_ALLOWED_ORIGINS: v("https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}", "Sites allowed to call the API. Same as your Plane address"),
    DATABASE_URL: v("${{plane-db.DATABASE_URL}}", "Database address, from plane-db"),
    REDIS_URL: v("${{plane-redis.REDIS_URL}}", "Cache address, from plane-redis"),
    AMQP_URL: v("${{plane-mq.AMQP_URL}}", "Queue address, from plane-mq"),
    USE_MINIO: v("1", "Keep uploads in the bundled file storage"),
    // Railway ends TLS at its edge, so Plane must sign upload URLs as https.
    MINIO_ENDPOINT_SSL: v("1", "Make upload links use https, as Railway serves only https"),
    AWS_ACCESS_KEY_ID: v("${{plane-minio.MINIO_ROOT_USER}}", "File storage access key, from plane-minio"),
    AWS_SECRET_ACCESS_KEY: v("${{plane-minio.MINIO_ROOT_PASSWORD}}", "File storage secret key, from plane-minio"),
    AWS_S3_ENDPOINT_URL: v("${{plane-minio.S3_ENDPOINT_URL}}", "File storage address, from plane-minio"),
    AWS_S3_BUCKET_NAME: v("uploads", "Folder for uploaded files. Plane creates it on first start"),
  },
});

// worker and beat-worker run the same image with the same settings as api.
const backendEnv = Object.fromEntries(
  [
    "SECRET_KEY", "LIVE_SERVER_SECRET_KEY", "WEB_URL", "CORS_ALLOWED_ORIGINS",
    "DATABASE_URL", "REDIS_URL", "AMQP_URL", "USE_MINIO", "MINIO_ENDPOINT_SSL",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_ENDPOINT_URL", "AWS_S3_BUCKET_NAME",
  ].map((key) => [key, v(`\${{api.${key}}}`, `Same as ${key} on api`)]),
);

// bin/docker-entrypoint-worker.sh with a fixed pool size. Without one, Celery
// starts a process per CPU it can see: 48 on Railway, about 3.7 GB of memory.
const worker = service("worker", {
  source: image(`makeplane/plane-backend:${PLANE}`),
  start: `/bin/sh -c 'python manage.py wait_for_db && python manage.py wait_for_migrations && exec celery -A plane worker -l info --concurrency "$WORKER_CONCURRENCY"'`,
  replicas,
  env: {
    ...backendEnv,
    WORKER_CONCURRENCY: v("2", "Number of background job processes. More run more jobs at once and use more memory"),
  },
});

const beatWorker = service("beat-worker", {
  source: image(`makeplane/plane-backend:${PLANE}`),
  start: "./bin/docker-entrypoint-beat.sh",
  replicas,
  env: backendEnv,
});

const live = service("live", {
  source: image(`makeplane/plane-live:${PLANE}`),
  healthcheck: "/live/health",
  replicas,
  env: {
    PORT: v("3000", "Port the live service listens on"),
    API_BASE_URL: v("http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000", "API address on the private network"),
    LIVE_SERVER_SECRET_KEY: v("${{api.LIVE_SERVER_SECRET_KEY}}", "Same as LIVE_SERVER_SECRET_KEY on api"),
    REDIS_URL: v("${{plane-redis.REDIS_URL}}", "Cache address, from plane-redis"),
  },
});

// web and admin serve static files with nginx on 3000; space is a Node server
// that reads PORT and serves only under /spaces/. PORT also tells Railway
// where to run the healthcheck.
// https://docs.railway.com/deployments/healthchecks#configure-the-healthcheck-port
const frontend = (name: string, img: string, healthcheck = "/") =>
  service(name, {
    source: image(`${img}:${PLANE}`),
    healthcheck,
    replicas,
    env: { PORT: v("3000", "Port this service listens on. Railway checks its health here") },
  });

const web = frontend("web", "makeplane/plane-frontend");
const space = frontend("space", "makeplane/plane-space", "/spaces/");
const admin = frontend("admin", "makeplane/plane-admin");

const host = (svc: string) => v(`\${{${svc}.RAILWAY_PRIVATE_DOMAIN}}`, `Private address of ${svc}`);

// Plane's Caddy proxy with the upstreams pointed at Railway's private
// hostnames. The only public service. Deploying from a fork? Point this at it.
const proxy = service("proxy", {
  source: github("Ntelikatos/plane-railway", { branch: "main", rootDirectory: "proxy" }),
  build: { watchPatterns: ["/proxy/**"] },
  healthcheck: "/",
  replicas,
  // A generated *.up.railway.app domain on port 80.
  networking: { serviceDomains: { "<hasDomain>": { port: 80 } } },
  env: {
    PORT: v("80", "Port the proxy listens on. Your public domain points here"),
    BUCKET_NAME: v("${{api.AWS_S3_BUCKET_NAME}}", "Folder for uploaded files, from api"),
    WEB_HOST: host("web"),
    SPACE_HOST: host("space"),
    ADMIN_HOST: host("admin"),
    LIVE_HOST: host("live"),
    API_HOST: host("api"),
    MINIO_HOST: host("plane-minio"),
  },
});

export default defineRailway(() =>
  project("plane", {
    resources: [
      proxy, web, space, admin, live, api, worker, beatWorker,
      db, redis, mq, minio,
      pgdata, redisdata, mqdata, uploads,
    ],
  }),
);
