#!/usr/bin/env bash
# =============================================================
# One-shot deployment of Zuigo Due Reminder on a Hostinger VPS
# Target: Ubuntu 22.04 / 24.04 (default Hostinger VPS images)
# Serves: https://amt.zuigo.in
#
# Run as root:  bash setup-vps.sh
# =============================================================
set -euo pipefail

# ----------------- Configuration -----------------
DOMAIN="amt.zuigo.in"
REPO_URL="https://github.com/ZuiGO/Zuigo-Due-Remainder.git"
APP_DIR="/var/www/amt-zuigo"
APP_PORT="3000"
DB_NAME="zuigo_due_reminder"
DB_USER="zuigo"
# Random credentials generated on first run, stored in /root/amt-zuigo-credentials.txt
DB_PASS="$(openssl rand -hex 16)"
APP_SECRET="$(openssl rand -hex 32)"
CERTBOT_EMAIL="manishathakkar@gmail.com"   # used for Let's Encrypt expiry notices
# --------------------------------------------------

echo "==> [1/8] Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx openssl

echo "==> [2/8] Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> [3/8] Setting up PostgreSQL database..."
systemctl enable --now postgresql
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  echo "    DB user already exists, resetting password..."
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "==> [4/8] Cloning application..."
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" pull
else
  mkdir -p "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

echo "==> [5/8] Writing .env..."
cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
SESSION_SECRET="${APP_SECRET}"
JWT_SECRET="${APP_SECRET}"
PORT=${APP_PORT}
# Optional: AI features (summaries etc.)
# GROQ_API_KEY="gsk_..."
# Optional: automatic daily reminder dispatch
# AUTO_DISPATCH_TENANT="abmato"
# AUTO_DISPATCH_TIME="09:30"
# AUTO_DISPATCH_TZ="Asia/Kolkata"
EOF

cat > /root/amt-zuigo-credentials.txt <<EOF
Zuigo Due Reminder — generated $(date)
DB:        postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
App secret: ${APP_SECRET}
App dir:    ${APP_DIR}
EOF
chmod 600 /root/amt-zuigo-credentials.txt

echo "==> [6/8] Installing dependencies, migrating DB, building..."
cd "${APP_DIR}"
npm ci || npm install
npx prisma generate
npx prisma db push
npm run db:seed || echo "    (seed skipped or already applied)"
npm run build

echo "==> [7/8] Starting app with PM2..."
pm2 delete amt-zuigo >/dev/null 2>&1 || true
pm2 start npm --name amt-zuigo --cwd "${APP_DIR}" -- start
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "==> [8/8] Configuring Nginx + SSL for ${DOMAIN}..."
cat > /etc/nginx/sites-available/${DOMAIN} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
nginx -t && systemctl reload nginx

# SSL — requires the DNS A record for ${DOMAIN} to already point at this server
if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect; then
  echo "    SSL installed."
else
  echo "    !! Certbot failed — most likely DNS for ${DOMAIN} is not pointing here yet."
  echo "    Fix the DNS A record, wait a few minutes, then run:"
  echo "    certbot --nginx -d ${DOMAIN} --redirect -m ${CERTBOT_EMAIL} --agree-tos"
fi

echo ""
echo "============================================================"
echo " DONE. App: https://${DOMAIN}"
echo " Default login: jayesh@zuigo.ai / zuigo123  (change it!)"
echo " Credentials saved to: /root/amt-zuigo-credentials.txt"
echo " Logs: pm2 logs amt-zuigo"
echo "============================================================"
