#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "Please run with sudo: sudo $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/5] Installing Nginx configs..."
install -m 0644 "$SCRIPT_DIR/nginx/00-proxy-maps.conf" /etc/nginx/conf.d/00-proxy-maps.conf
install -m 0644 "$SCRIPT_DIR/nginx/zarfolio.ir.conf" /etc/nginx/sites-available/zarfolio.ir
ln -sfn /etc/nginx/sites-available/zarfolio.ir /etc/nginx/sites-enabled/zarfolio.ir

echo "[2/5] Testing and reloading Nginx..."
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "[3/5] Installing systemd units..."
install -m 0644 "$SCRIPT_DIR/systemd/zarfolio-backend.service" /etc/systemd/system/zarfolio-backend.service
install -m 0644 "$SCRIPT_DIR/systemd/zarfolio-frontend.service" /etc/systemd/system/zarfolio-frontend.service
install -m 0644 "$SCRIPT_DIR/systemd/zarfolio-boot.timer" /etc/systemd/system/zarfolio-boot.timer

echo "[4/5] Configuring 90s post-boot timer..."
systemctl daemon-reload
# Ensure services only start via the 90s boot timer (not immediately on boot)
systemctl disable zarfolio-backend.service zarfolio-frontend.service >/dev/null 2>&1 || true
systemctl enable --now zarfolio-boot.timer

echo "[5/5] Starting Zarfolio services now..."
systemctl restart zarfolio-backend.service
systemctl restart zarfolio-frontend.service

echo ""
echo "=== Status ==="
systemctl --no-pager --full status zarfolio-boot.timer zarfolio-backend.service zarfolio-frontend.service | head -n 45 || true
echo ""
echo "=== Local HTTP Check (Host: zarfolio.ir) ==="
for i in $(seq 1 15); do
    if curl -sSf -o /dev/null -H "Host: zarfolio.ir" http://127.0.0.1/; then
        curl -sI -H "Host: zarfolio.ir" http://127.0.0.1/ | head -n 10
        echo "OK: Nginx -> Zarfolio is responding!"
        exit 0
    fi
    sleep 1
done

echo "WARNING: Zarfolio did not respond on http://127.0.0.1/ within 15s. Check logs:"
echo "  journalctl -u zarfolio-backend -u zarfolio-frontend -n 50 --no-pager"
exit 1
