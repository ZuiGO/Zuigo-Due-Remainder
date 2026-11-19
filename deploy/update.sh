#!/usr/bin/env bash
# Redeploy latest code from GitHub. Run as root on the VPS: bash update.sh
set -euo pipefail
APP_DIR="/var/www/amt-zuigo"

cd "${APP_DIR}"
git pull
npm ci || npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart amt-zuigo
echo "Updated and restarted. Logs: pm2 logs amt-zuigo"
