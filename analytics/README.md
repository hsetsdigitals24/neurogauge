# Neurogauge Analytics

FastAPI sidecar exposing statistical analyses to the Next.js app.

## Local dev

```bash
uv sync
ANALYTICS_SHARED_SECRET=dev-secret-change-me uv run uvicorn app.main:app --reload
```

Or via docker-compose from the repo root:

```bash
docker compose up analytics
```

Then `curl localhost:8000/healthz`.

## Tests

```bash
uv run pytest
```

## Endpoints (Phase 1)

- `GET  /healthz` — liveness, no auth
- `POST /v1/descriptive` — mean, median, mode, SD, SE, 95% CI
- `POST /v1/normality` — Shapiro-Wilk, KS, skewness, kurtosis + histogram + QQ plot

All `/v1/*` endpoints require header `X-Analytics-Key: $ANALYTICS_SHARED_SECRET`.

## Request envelope

```json
{
  "data": [ { "rt_ms": 412, "level": 2 }, ... ],
  "variables": { "columns": ["rt_ms"], "group_by": "level" },
  "options":   { "ci_level": 0.95 }
}
```

## Production deploy (VPS + Docker + Nginx + Let's Encrypt)

Next.js runs on Vercel; this service runs on a VPS, fronted by Nginx with a TLS cert from Let's Encrypt. The shared secret is the auth boundary.

### One-time VPS setup

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
# Docker + compose plugin (skip if already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

Point a DNS A record at the VPS, e.g. `analytics.example.com → <vps-ip>`.

### Deploy the service

```bash
# On the VPS, clone the repo (or copy just the analytics/ directory)
git clone <repo-url> neurogauge && cd neurogauge/analytics

# Create the production env file
cp .env.production.example .env.production
# Generate and paste a strong secret:
openssl rand -hex 32
# → set ANALYTICS_SHARED_SECRET in .env.production

# Start the container (binds to 127.0.0.1:8000 only)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Verify
curl -s http://127.0.0.1:8000/healthz
```

### Configure Nginx + TLS

```bash
# Copy the site config, replacing the placeholder with your domain
sudo sed 's/ANALYTICS_DOMAIN/analytics.example.com/g' \
  deploy/nginx/analytics.conf \
  | sudo tee /etc/nginx/sites-available/analytics.conf
sudo ln -sf /etc/nginx/sites-available/analytics.conf /etc/nginx/sites-enabled/

sudo nginx -t && sudo systemctl reload nginx

# Issue the cert (certbot rewrites the file to add the SSL block)
sudo certbot --nginx -d analytics.example.com

# Verify externally
curl -s https://analytics.example.com/healthz
```

Certbot installs a renewal timer automatically (`systemctl list-timers | grep certbot`).

### Point Vercel at it

In the Vercel project (Settings → Environment Variables) add to all environments where you want analytics:

```
ANALYTICS_URL=https://analytics.example.com
ANALYTICS_SHARED_SECRET=<same value as in .env.production>
```

Redeploy. The Next.js proxy at `src/app/api/analytics/[...path]/route.ts` will forward to the VPS.

### Updates

```bash
cd ~/neurogauge && git pull
cd analytics
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Operational notes

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f --tail=200 analytics`
- **Restart**: `docker compose -f docker-compose.prod.yml restart analytics`
- **Firewall**: only ports 22 / 80 / 443 should be open. Port 8000 stays bound to 127.0.0.1, never publicly exposed.
- **Secret rotation**: regenerate `ANALYTICS_SHARED_SECRET`, update both the `.env.production` and the Vercel env var, then redeploy Vercel and restart the container.
- **Workers**: the Dockerfile runs `uvicorn --workers 2`. Bump to `--workers $(nproc)` if you have a beefy VPS and concurrent analyses.

## Response envelope

```json
{
  "ok": true,
  "stats": { ... },
  "table": { "csv": "...", "headers": [...], "rows": [[...]] },
  "plots": [ { "type": "histogram", "plotly": {...} } ],
  "warnings": [],
  "meta": { "n": 100, "duration_ms": 12, "version": "0.1.0" }
}
```
