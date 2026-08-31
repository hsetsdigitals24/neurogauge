# Fresh VPS Setup for the Analytics Service — Beginner's Guide

This guide takes a **brand-new, empty VPS** and gets the Python analytics service running on
it, reachable at `https://analytics.learnogauge.com`. Do this **once**, by hand.

When you're done, hand off to [`GITLAB_CICD_SETUP.md`](./GITLAB_CICD_SETUP.md) so that all
future updates deploy automatically — you won't touch the VPS by hand again.

> **What you need before starting**
> - A fresh VPS (Ubuntu 22.04 or 24.04 LTS assumed here) with **root** or a `sudo` user.
> - The VPS's public IP address.
> - Access to the DNS for `learnogauge.com` (to point the subdomain at the VPS).
> - Your GitLab project: `https://gitlab.com/h-sets-group/neurogauge`.

Every command below runs **on the VPS** unless it says otherwise. Log in first:

```bash
ssh root@YOUR_VPS_IP        # or  ssh youruser@YOUR_VPS_IP
```

---

## The big picture (read this once)

The analytics service is a small Python web app that runs inside **Docker**. Nothing on the
public internet talks to it directly — instead:

```
Browser / your Next.js app
        │  HTTPS (port 443)
        ▼
     Nginx  ──────────────►  Docker container (127.0.0.1:8000)
   (TLS, public)              (the analytics service, private)
```

- **Docker** runs the service, bound to `127.0.0.1:8000` (localhost only — not exposed).
- **Nginx** sits in front, terminates HTTPS, and forwards requests to `localhost:8000`.
- **Let's Encrypt** (via certbot) gives Nginx a free TLS certificate.

So the setup is: create a user → install Docker → install Nginx + certificate → get the
code → configure the secret → start the container → point Nginx at it.

---

## Step 1 — Create a deploy user (skip if you already have a non-root user)

Running everything as `root` is risky. Make a dedicated user for the app.

```bash
adduser deploy                 # set a password when prompted
usermod -aG sudo deploy        # allow sudo
```

Let this user use Docker without `sudo` (you'll add the group in Step 2, but do the user
part now):

```bash
# (run again after Docker is installed if the 'docker' group doesn't exist yet)
usermod -aG docker deploy 2>/dev/null || true
```

From here on, work as `deploy`:

```bash
su - deploy
```

> **Note the folder** you'll clone into. This guide uses `/home/deploy/neurogauge`. That
> exact path becomes `VPS_APP_DIR` in the CI/CD guide later.

---

## Step 2 — Install Docker + Docker Compose

Install Docker's official package (includes the `docker compose` plugin):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Add your user to the `docker` group (so you don't need `sudo` for docker), then re-apply it:

```bash
sudo usermod -aG docker $USER
# log out and back in for group change to take effect:
exit          # drops you back to root or your ssh session
su - deploy   # (or reconnect: ssh deploy@YOUR_VPS_IP)
```

**Verify Docker works:**

```bash
docker run --rm hello-world
docker compose version
```

You should see a "Hello from Docker!" message and a compose version number.

---

## Step 3 — Point DNS at the VPS

In your DNS provider for `learnogauge.com`, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `analytics` | `YOUR_VPS_IP` |

Wait a few minutes, then confirm it resolves (run this **on your laptop** or the VPS):

```bash
dig +short analytics.learnogauge.com
```

It should print your VPS IP. Don't continue to the certificate step until it does — Let's
Encrypt needs the DNS to point here to verify you own the domain.

---

## Step 4 — Get the code onto the VPS

The container is built from the repo. Clone it (read-only is fine — deploys pull, they don't push).

First, let the VPS authenticate to GitLab. Create an SSH key on the VPS and add it as a
**Deploy Key** in GitLab:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copy that public line, then in the browser: GitLab project → **Settings → Repository →
Deploy keys → Add deploy key**, paste it, title it `VPS analytics`, leave write access
**off**, save.

Now clone into the folder you noted in Step 1:

```bash
cd ~
git clone git@gitlab.com:h-sets-group/neurogauge.git
# first connection asks to trust gitlab.com — type: yes
cd neurogauge
pwd     # confirm: /home/deploy/neurogauge  ← this is VPS_APP_DIR
```

---

## Step 5 — Configure the secret

The service needs one secret, `ANALYTICS_SHARED_SECRET`, which **must match** the value set
in your Vercel environment variables (that's how the Next.js app authenticates to it).

```bash
cd ~/neurogauge/analytics
cp .env.production.example .env.production
```

If you don't already have a shared secret, generate one:

```bash
openssl rand -hex 32
```

Edit `.env.production` and paste the value:

```bash
nano .env.production
# set:  ANALYTICS_SHARED_SECRET=<the value that matches Vercel>
```

> ⚠️ **Use the same secret on both sides.** If Vercel already has
> `ANALYTICS_SHARED_SECRET`, copy that exact value here. Never regenerate it on only one
> side — the app will start getting 401s from the analytics service.

---

## Step 6 — Build and start the container

From the `analytics` folder:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This builds the image and starts the container in the background. Check it:

```bash
docker compose -f docker-compose.prod.yml ps      # STATUS should be 'Up (healthy)'
curl -fsS http://127.0.0.1:8000/healthz && echo   # should print a health response
```

If the health check responds, the service is running (privately on port 8000). Next we make
it reachable over HTTPS.

---

## Step 7 — Install Nginx and the TLS certificate

Install Nginx and certbot:

```bash
sudo apt-get install -y nginx
sudo snap install --classic certbot 2>/dev/null || sudo apt-get install -y certbot python3-certbot-nginx
```

Create the Nginx site config:

```bash
sudo nano /etc/nginx/sites-available/analytics
```

Paste this (note `client_max_body_size 50m` — large analysis payloads need it):

```nginx
server {
    server_name analytics.learnogauge.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    listen 80;
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/analytics /etc/nginx/sites-enabled/
sudo nginx -t                 # test config — should say "syntax is ok"
sudo systemctl reload nginx
```

Now get the HTTPS certificate (certbot edits the config to add TLS automatically):

```bash
sudo certbot --nginx -d analytics.learnogauge.com
```

Follow the prompts (enter an email, agree to terms, choose to redirect HTTP→HTTPS). Certbot
auto-renews via a systemd timer — nothing more to do.

**Verify from your laptop:**

```bash
curl -fsS https://analytics.learnogauge.com/healthz && echo
```

A healthy response over HTTPS means the whole chain works.

---

## Step 8 — Open the firewall (if one is enabled)

If `ufw` is active, allow SSH and web traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # opens 80 + 443
sudo ufw status
```

Port 8000 stays **closed** to the public on purpose — only Nginx (localhost) talks to it.

---

## Step 9 — Point Vercel at the service

In your Vercel project settings → Environment Variables, make sure both are set (and match
the VPS):

| Variable | Value |
|---|---|
| `ANALYTICS_URL` | `https://analytics.learnogauge.com` |
| `ANALYTICS_SHARED_SECRET` | the same secret you put in `.env.production` |

Redeploy the Next.js app (or it picks them up on the next deploy). The workbench should now
be able to run analyses.

---

## Step 10 — Hand off to automated deploys

The VPS is now serving the analytics service. From here, **don't update it by hand** — set
up GitLab CI/CD so every push under `analytics/` tests + redeploys automatically.

Follow [`GITLAB_CICD_SETUP.md`](./GITLAB_CICD_SETUP.md). The values you'll need are already
known from this guide:

- `VPS_HOST` = `YOUR_VPS_IP` (or `analytics.learnogauge.com`)
- `VPS_USER` = `deploy`
- `VPS_APP_DIR` = `/home/deploy/neurogauge` (whatever `pwd` printed in Step 4)

The deploy key you added in Step 4 already lets the VPS pull from GitLab, so that part's done.

---

## Quick reference — managing the service by hand

Run these from `~/neurogauge/analytics`:

| Task | Command |
|---|---|
| See status | `docker compose -f docker-compose.prod.yml ps` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Restart | `docker compose -f docker-compose.prod.yml restart` |
| Rebuild after code change | `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` |
| Stop | `docker compose -f docker-compose.prod.yml down` |
| Health check | `curl http://127.0.0.1:8000/healthz` |

---

## Troubleshooting

**`curl http://127.0.0.1:8000/healthz` fails**
The container didn't come up. Check `docker compose -f docker-compose.prod.yml logs`. A
common cause is a missing/empty `ANALYTICS_SHARED_SECRET` in `.env.production`.

**`certbot` fails with a challenge error**
DNS isn't pointing at the VPS yet, or port 80 is blocked. Confirm `dig +short
analytics.learnogauge.com` returns your IP and that the firewall allows Nginx (Step 8).

**HTTPS works but the app gets 401 from analytics**
`ANALYTICS_SHARED_SECRET` differs between Vercel and the VPS. Make them identical.

**413 "Request Entity Too Large"**
`client_max_body_size 50m;` is missing from the Nginx config (Step 7). Add it, `sudo nginx
-t`, `sudo systemctl reload nginx`.

**`docker: permission denied`**
Your user isn't in the `docker` group yet, or you didn't reconnect after adding it. Re-run
`sudo usermod -aG docker $USER` and start a fresh SSH session.

**Build fails: `Failed to build statsmodels` / `Unknown compiler(s)` / `cc … No such file`**
A dependency has no prebuilt wheel for this platform and is trying to compile from source,
but the slim image has no C compiler. This service pins `statsmodels>=0.14,<0.15` in
`pyproject.toml` precisely to stay on a version that ships wheels — if you see this, confirm
that pin is present (`grep statsmodels pyproject.toml`). Avoid removing the upper bound.

**`required variable ANALYTICS_SHARED_SECRET is missing a value`**
You ran a `docker compose` command without `--env-file .env.production`. Every compose
command (`up`, `ps`, `logs`, …) needs it, because the compose file requires that variable at
parse time. Always include `--env-file .env.production`.
