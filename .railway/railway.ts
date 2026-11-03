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
    POSTGRES_USER: v("plane", "Database user"),
    POSTGRES_DB: v("plane", "Database name"),
    POSTGRES_PASSWORD: v(secret(32), "Database password, generated at deploy"),
    // A Railway volume has lost+found at its root, which initdb refuses.
    PGDATA: v("/var/lib/postgresql/data/pgdata", "Data directory, one level inside the volume"),
    DATABASE_URL: v(
      "postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}",
      "Connection string the Plane services use",
    ),
    RAILWAY_DEPLOYMENT_DRAINING_SECONDS: v("60", "Seconds Postgres gets to shut down cleanly"),
  },
});

const redis = service("plane-redis", {
  source: image("valkey/valkey:7.2.11-alpine"),
  start: `/bin/sh -c 'exec docker-entrypoint.sh valkey-server --requirepass "$VALKEY_PASSWORD"'`,
  replicas,
  volumeMounts: { "/data": redisdata },
  env: {
    VALKEY_PASSWORD: v(secret(32), "Valkey password, generated at deploy"),
    REDIS_URL: v(
      "redis://default:${{VALKEY_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/",
      "Connection string the Plane services use",
    ),
  },
});

const mq = service("plane-mq", {
  source: image("rabbitmq:3.13.6-management-alpine"),
  replicas,
  volumeMounts: { "/var/lib/rabbitmq": mqdata },
  env: {
    RABBITMQ_DEFAULT_USER: v("plane", "Broker user"),
    RABBITMQ_DEFAULT_PASS: v(secret(32), "Broker password, generated at deploy"),
    RABBITMQ_DEFAULT_VHOST: v("plane", "Broker virtual host"),
    // RabbitMQ keys its data directory by node name, which defaults to the
    // container hostname. Railway changes the hostname on every deploy.
    RABBITMQ_NODENAME: v("rabbit@localhost", "Fixed node name, so queues survive redeploys"),
    AMQP_URL: v(
      "amqp://${{RABBITMQ_DEFAULT_USER}}:${{RABBITMQ_DEFAULT_PASS}}@${{RAILWAY_PRIVATE_DOMAIN}}:5672/${{RABBITMQ_DEFAULT_VHOST}}",
      "Connection string the Plane services use",
    ),
  },
});

const minio = service("plane-minio", {
  source: image("pgsty/silo:RELEASE.2026-09-16T00-00-00Z"),
  start: '/usr/bin/docker-entrypoint.sh server /export --console-address ":9090"',
  replicas,
  volumeMounts: { "/export": uploads },
  env: {
    MINIO_ROOT_USER: v(secret(20), "Storage access key, generated at deploy"),
    MINIO_ROOT_PASSWORD: v(secret(40), "Storage secret key, generated at deploy"),
    S3_ENDPOINT_URL: v("http://${{RAILWAY_PRIVATE_DOMAIN}}:9000", "Storage endpoint on the private network"),
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
    GUNICORN_WORKERS: v("1", "API worker processes; raise together with memory"),
    SECRET_KEY: v(secret(50), "Django secret key, generated at deploy"),
    LIVE_SERVER_SECRET_KEY: v(secret(64, "abcdef0123456789"), "Secret shared with live, generated at deploy"),
    WEB_URL: v("https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}", "Public URL of this Plane instance"),
    CORS_ALLOWED_ORIGINS: v("https://${{proxy.RAILWAY_PUBLIC_DOMAIN}}", "Origins allowed to call the API"),
    DATABASE_URL: v("${{plane-db.DATABASE_URL}}", "Postgres connection string"),
    REDIS_URL: v("${{plane-redis.REDIS_URL}}", "Valkey connection string"),
    AMQP_URL: v("${{plane-mq.AMQP_URL}}", "RabbitMQ connection string"),
    USE_MINIO: v("1", "Use the bundled object storage"),
    // Railway ends TLS at its edge, so Plane must sign upload URLs as https.
    MINIO_ENDPOINT_SSL: v("1", "Sign upload URLs as https, since Railway ends TLS"),
    AWS_ACCESS_KEY_ID: v("${{plane-minio.MINIO_ROOT_USER}}", "Storage access key"),
    AWS_SECRET_ACCESS_KEY: v("${{plane-minio.MINIO_ROOT_PASSWORD}}", "Storage secret key"),
    AWS_S3_ENDPOINT_URL: v("${{plane-minio.S3_ENDPOINT_URL}}", "Storage endpoint"),
    AWS_S3_BUCKET_NAME: v("uploads", "Bucket for uploads; Plane creates it on start"),
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

const worker = service("worker", {
  source: image(`makeplane/plane-backend:${PLANE}`),
  start: "./bin/docker-entrypoint-worker.sh",
  replicas,
  env: backendEnv,
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
    PORT: v("3000", "Port the server listens on"),
    API_BASE_URL: v("http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000", "API on the private network"),
    LIVE_SERVER_SECRET_KEY: v("${{api.LIVE_SERVER_SECRET_KEY}}", "Same as LIVE_SERVER_SECRET_KEY on api"),
    REDIS_URL: v("${{plane-redis.REDIS_URL}}", "Valkey connection string"),
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
    env: { PORT: v("3000", "Port Plane's image serves on; the healthcheck uses it") },
  });

const web = frontend("web", "makeplane/plane-frontend");
const space = frontend("space", "makeplane/plane-space", "/spaces/");
const admin = frontend("admin", "makeplane/plane-admin");

const host = (svc: string) => v(`\${{${svc}.RAILWAY_PRIVATE_DOMAIN}}`, `Private hostname of ${svc}`);

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
    PORT: v("80", "Port Caddy listens on; the domain and healthcheck use it"),
    BUCKET_NAME: v("${{api.AWS_S3_BUCKET_NAME}}", "Path routed to file storage"),
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
