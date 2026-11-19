# Deploying Zuigo Due Reminder to amt.zuigo.in (Hostinger VPS)

Everything runs on your Hostinger VPS: Node.js 20, PostgreSQL, Nginx reverse proxy, and free Let's Encrypt SSL.

## Step 1 — Point the subdomain at your VPS

1. Find your VPS IP: **hPanel → VPS → your server** (the IPv4 address).
2. Open the DNS zone for `zuigo.in`: **hPanel → Domains → zuigo.in → DNS / Nameservers**.
3. Add a record:
   - **Type:** `A`
   - **Name:** `amt`
   - **Points to:** `<your VPS IPv4>`
   - **TTL:** default (or 300)
4. Wait a few minutes for DNS to propagate (check with `nslookup amt.zuigo.in`).

> Do this **before** running the setup script so SSL issuance succeeds on the first try.

## Step 2 — Run the setup script on the VPS

SSH into the VPS (from hPanel you can find the SSH details; usually `ssh root@<VPS-IP>`), then:

```bash
curl -fsSL https://raw.githubusercontent.com/ZuiGO/Zuigo-Due-Remainder/main/deploy/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

(If the script isn't pushed to GitHub yet, copy it over instead:
`scp deploy/setup-vps.sh root@<VPS-IP>:~/` from this folder on your PC.)

The script is idempotent — safe to re-run if something fails midway. It:

1. Installs Node.js 20, PostgreSQL, Nginx, Certbot, PM2
2. Creates the `zuigo_due_reminder` database with a random password
3. Clones the repo to `/var/www/amt-zuigo` and writes `.env`
4. Runs `prisma db push` + seed, builds the app
5. Starts it under PM2 (auto-restarts on crash and on server reboot)
6. Configures Nginx for `amt.zuigo.in` and installs the SSL certificate

Generated credentials are saved to `/root/amt-zuigo-credentials.txt`.

## Step 3 — Log in and secure

- Open **https://amt.zuigo.in**
- Default admin: `jayesh@zuigo.ai` / `zuigo123` — **change this password immediately**.
- Configure SMTP in **Settings** for live email reminders.
- Optional `.env` extras (then `pm2 restart amt-zuigo`):
  - `GROQ_API_KEY` — AI features
  - `AUTO_DISPATCH_TENANT`, `AUTO_DISPATCH_TIME`, `AUTO_DISPATCH_TZ` — automatic daily reminder dispatch

## Updating later

After pushing changes to GitHub:

```bash
bash /var/www/amt-zuigo/deploy/update.sh
```

## Useful commands

| Task | Command |
|---|---|
| App logs | `pm2 logs amt-zuigo` |
| Restart app | `pm2 restart amt-zuigo` |
| App status | `pm2 status` |
| Nginx test/reload | `nginx -t && systemctl reload nginx` |
| DB console | `sudo -u postgres psql zuigo_due_reminder` |
| Renew SSL (auto anyway) | `certbot renew` |
