---
name: deploy
description: Deploy Jake to production (Vultr VPS). Pulls latest images, runs docker compose, verifies health.
disable-model-invocation: true
---

# Deploy to Production

Deploy the Jake app to the Vultr VPS at `192.248.177.48` (jakestudy.xyz).

## Prerequisites

- SSH key at `~/.ssh/jake-deploy`
- Docker images already built and pushed to `ghcr.io/natashkinsasha/jake-api` and `ghcr.io/natashkinsasha/jake-web` (CI/CD does this automatically on push to main)

## Deployment Steps

### 1. Verify local state

Before deploying, confirm you're on `main` and everything is pushed:

```bash
git status
git log --oneline -3
```

### 2. SSH into the server

```bash
ssh -i ~/.ssh/jake-deploy root@192.248.177.48
```

### 3. Pull latest images and restart

On the server (`/root/jake/`):

```bash
cd /root/jake
docker compose -f docker-compose.prod.yml pull api worker web
docker compose -f docker-compose.prod.yml up -d api worker web
```

### 4. Run database migrations (if needed)

Only if there are new migration files:

```bash
docker compose -f docker-compose.prod.yml run --rm api node dist/migrate.js
```

### 5. Health check

```bash
curl -f https://jakestudy.xyz/api/health
```

Expected: `200 OK`

### 6. Check logs if something is wrong

```bash
docker compose -f docker-compose.prod.yml logs --tail=50 api
docker compose -f docker-compose.prod.yml logs --tail=50 web
docker compose -f docker-compose.prod.yml logs --tail=50 worker
```

## Rollback

If the deploy fails, roll back to the previous image:

```bash
cd /root/jake
docker compose -f docker-compose.prod.yml down api worker web
docker compose -f docker-compose.prod.yml pull api worker web  # previous tag
docker compose -f docker-compose.prod.yml up -d api worker web
```

## Notes

- CI/CD (`deploy.yml`) already handles the full pipeline: lint, test, build, push, deploy, health check, rollback on failure.
- Use this skill for manual deploys or when CI/CD is bypassed.
- `.env` on the server is at `/root/jake/.env` — edit it directly on the server if env vars need to change.
- Nginx config is at `/root/jake/infra/nginx.conf` — after changes, reload with `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.
