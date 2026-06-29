#!/bin/bash
# =============================================================================
# KDS – Klinisches Dokumentationssystem – Update-Script (vollautomatisch)
# =============================================================================
set -u
# KEIN set -e damit einzelne Fehler nicht das ganze Script abbrechen

APP_DIR="/opt/kds"
APP_USER="kds"
SERVICE="kds"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()    { echo -e "\n${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail()    { echo -e "${RED}✗ $1${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && fail "Bitte als root ausführen: sudo bash update.sh"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  KDS – Klinisches Dokumentationssystem   $(date '+%d.%m.%Y %H:%M')${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"

# ─── 1. Git ───────────────────────────────────────────────────────────────────
step "Git: Änderungen holen"
sudo -u "$APP_USER" git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main || fail "git reset fehlgeschlagen"
sudo -u "$APP_USER" git -C "$APP_DIR" pull origin main || fail "git pull fehlgeschlagen"
COMMIT=$(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)
success "Commit: $COMMIT"

# ─── 2. NEXTAUTH_URL ──────────────────────────────────────────────────────────
step "NEXTAUTH_URL prüfen"
ENV_FILE="$APP_DIR/.env"

# Nginx-Domain suchen (|| true verhindert Abbruch wenn nichts gefunden)
NGINX_DOMAIN=""
if [[ -d /etc/nginx/sites-enabled ]]; then
  NGINX_DOMAIN=$(grep -rh "server_name" /etc/nginx/sites-enabled/ 2>/dev/null \
    | grep -v "localhost\|127\.0\.0\.1\| _\b" \
    | awk '{print $2}' | tr -d ';' \
    | grep -E "^[a-zA-Z0-9].*\.[a-zA-Z]{2,}$" \
    | head -1 || true)
fi

if [[ -n "$NGINX_DOMAIN" ]]; then
  if [[ -f "/etc/letsencrypt/live/$NGINX_DOMAIN/fullchain.pem" ]]; then
    NEW_URL="https://$NGINX_DOMAIN"
  else
    NEW_URL="http://$NGINX_DOMAIN"
  fi
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
  if [[ "$CURRENT_URL" != "$NEW_URL" ]]; then
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEW_URL|" "$ENV_FILE"
    warn "NEXTAUTH_URL aktualisiert: $CURRENT_URL → $NEW_URL"
  else
    success "NEXTAUTH_URL korrekt: $CURRENT_URL"
  fi
else
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "nicht gesetzt")
  success "NEXTAUTH_URL unverändert: $CURRENT_URL"
fi

# ─── 3. Dependencies ──────────────────────────────────────────────────────────
step "pnpm install"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install 2>&1 | tail -3" \
  || sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install 2>&1 | tail -3" \
  || fail "pnpm install fehlgeschlagen"
success "Abhängigkeiten installiert"

# ─── 4. Prisma Client ─────────────────────────────────────────────────────────
step "Prisma Client generieren"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && npx prisma generate 2>&1 | tail -3
" || fail "Prisma generate fehlgeschlagen"
success "Prisma Client generiert"

# ─── 5. Schema-Migration ──────────────────────────────────────────────────────
step "Datenbank-Schema migrieren"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && npx prisma db push --accept-data-loss 2>&1 | tail -5
" && success "Schema aktualisiert" || warn "Schema-Update fehlgeschlagen – App läuft mit altem Schema weiter"

# Session-Namen einmalig migrieren (idempotent)
# Rechnungsvorlage: erste aktive Vorlage als Standard setzen wenn keine gesetzt ist
sudo -u postgres psql kds_db -c "UPDATE \"InvoiceTemplate\" SET \"isDefault\" = true WHERE id = (SELECT id FROM \"InvoiceTemplate\" WHERE \"isActive\" = true ORDER BY \"createdAt\" ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM \"InvoiceTemplate\" WHERE \"isDefault\" = true AND \"isActive\" = true);" 2>/dev/null || true

# Status-Badge aus gespeicherten Rechnungsvorlagen entfernen
sudo -u postgres psql kds_db -c "UPDATE \"InvoiceTemplate\" SET \"htmlContent\" = REGEXP_REPLACE(\"htmlContent\", \'<tr><td>Status</td><td>[\\s\\S]*?</td></tr>\', \'\', \'g\') WHERE \"htmlContent\" LIKE '%Status</td><td>%';" 2>/dev/null || true

sudo -u postgres psql kds_db -c "DELETE FROM \"InvoiceDocument\" WHERE \"deletedAt\" IS NULL AND id NOT IN (SELECT DISTINCT ON (\"transactionId\") id FROM \"InvoiceDocument\" WHERE \"deletedAt\" IS NULL ORDER BY \"transactionId\", \"createdAt\" DESC);" 2>/dev/null || true
sudo -u postgres psql kds_db -c "UPDATE \"TherapySession\" SET name = REGEXP_REPLACE(name, '^Session-0*([0-9]+)', \'Sitzung-\\1\') WHERE name ~ '^Session-[0-9]+';" 2>/dev/null || true

# ─── 6. Seed ──────────────────────────────────────────────────────────────────
step "Seed: Basisdaten prüfen"

NEED_SEED=0
for TABLE in "Instrument" "AppointmentType" "PraxisConfig"; do
  COUNT=$(sudo -u postgres psql kds_db -t -c "SELECT COUNT(*) FROM \"$TABLE\";" 2>/dev/null | tr -d ' \n' || echo "0")
  if [[ "$COUNT" == "0" ]] || [[ -z "$COUNT" ]]; then
    warn "Tabelle $TABLE ist leer"
    NEED_SEED=1
  fi
done

if [[ $NEED_SEED -eq 1 ]]; then
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR && pnpm db:seed 2>&1 | tail -20
  " && success "Seed abgeschlossen" || warn "Seed fehlgeschlagen"
else
  success "Alle Basisdaten vorhanden – Seed übersprungen"
fi

# ─── 7. Build ─────────────────────────────────────────────────────────────────
step "Next.js Build"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && pnpm build 2>&1
" && success "Build erfolgreich" || fail "Build fehlgeschlagen – Service wird NICHT neu gestartet"

# ─── 8. Restart ───────────────────────────────────────────────────────────────
step "Service neu starten"
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE" && success "Service läuft" || fail "Service-Start fehlgeschlagen"

# ─── 9. Healthcheck ───────────────────────────────────────────────────────────
step "Healthcheck"
sleep 2
curl -sf "http://localhost:3000/api/auth/session" -o /dev/null 2>/dev/null \
  && success "App antwortet" \
  || warn "Healthcheck fehlgeschlagen – App läuft evtl. noch hoch"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Update abgeschlossen ✓${NC}"
echo -e "${GREEN}  $COMMIT${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"
systemctl status "$SERVICE" --no-pager -l | head -6
