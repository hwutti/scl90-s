#!/bin/bash
set -e
APP_DIR="/opt/scl90s"
APP_USER="scl90s"

echo "=== SCL-90-S Update ==="

sudo -u "$APP_USER" git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR"
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard
sudo -u "$APP_USER" git -C "$APP_DIR" pull origin main
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm build"
systemctl restart scl90s

echo "=== Fertig! ==="
systemctl status scl90s --no-pager -l
