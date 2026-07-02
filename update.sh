#!/bin/bash
# =============================================================================
# KDS – Klinisches Dokumentationssystem – Update-Script (vollautomatisch)
# =============================================================================
set -u
# KEIN set -e damit einzelne Fehler nicht das ganze Script abbrechen

APP_DIR="/opt/kds"
APP_USER="kds"
SERVICE="kds"
APP_PORT="3000"

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

# Selbst-Überschreibungs-Schutz: das Script holt sich oben gerade per git pull
# selbst neu. Bash liest die Datei aber zeilenweise von der Platte - wenn sich
# die Byte-Offsets durch den Pull verschieben, liest der laufende Prozess ab
# hier u.U. wirren/falschen Inhalt der NEUEN Datei statt des erwarteten Rests
# vom ALTEN Stand. Deshalb: einmalig sauber neu starten (exec ersetzt den
# Prozess, KDS_UPDATED verhindert eine Endlosschleife). Gleiches Muster wie bei
# fw-update (FF Görtschach).
if [[ -z "${KDS_UPDATED:-}" ]]; then
  export KDS_UPDATED=1
  exec bash "$APP_DIR/update.sh" "$@"
fi

COMMIT=$(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)
success "Commit: $COMMIT"

# ─── 2. NEXTAUTH_URL ──────────────────────────────────────────────────────────
step "NEXTAUTH_URL prüfen"
ENV_FILE="$APP_DIR/.env"

# Nginx-Domain aus allen gängigen Konfig-Pfaden suchen.
# Strategie: erst nach dem proxy_pass-Port suchen (sicherste Methode, unabhängig
# vom Dateinamen), dann server_name aus derselben Datei lesen.
NGINX_DOMAIN=""

# Alle nginx-Konfigurationsdateien auf dem System finden
ALL_NGINX_CONFS=$(find /etc/nginx /usr/local/etc/nginx 2>/dev/null -name "*.conf" -o -name "*.cfg" | sort)
# Auch Dateien ohne Endung in sites-*
ALL_NGINX_CONFS="$ALL_NGINX_CONFS $(find /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null -type f | sort)"

for CONF in $ALL_NGINX_CONFS; do
  [[ -f "$CONF" ]] || continue
  # Suche Datei die proxy_pass auf unseren App-Port enthält
  if grep -q "proxy_pass.*:${APP_PORT}" "$CONF" 2>/dev/null; then
    FOUND=$(grep "server_name" "$CONF" 2>/dev/null \
      | grep -v "localhost\|127\.0\.0\.1\| _\b" \
      | awk '{print $2}' | tr -d ';' \
      | grep -E "^[a-zA-Z0-9].*\.[a-zA-Z]{2,}$" \
      | head -1 || true)
    if [[ -n "$FOUND" ]]; then
      NGINX_DOMAIN="$FOUND"
      break
    fi
  fi
done

# Fallback: server_name aus allen nginx-Dateien ohne proxy_pass-Bedingung
if [[ -z "$NGINX_DOMAIN" ]]; then
  for CONF in $ALL_NGINX_CONFS; do
    [[ -f "$CONF" ]] || continue
    FOUND=$(grep "server_name" "$CONF" 2>/dev/null \
      | grep -v "localhost\|127\.0\.0\.1\| _\b" \
      | awk '{print $2}' | tr -d ';' \
      | grep -E "^[a-zA-Z0-9].*\.[a-zA-Z]{2,}$" \
      | head -1 || true)
    [[ -n "$FOUND" ]] && NGINX_DOMAIN="$FOUND" && break
  done
fi

# Fallback: Let's Encrypt Zertifikate
if [[ -z "$NGINX_DOMAIN" ]]; then
  LE_DOMAIN=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -v "README" | head -1 || true)
  [[ -n "$LE_DOMAIN" ]] && NGINX_DOMAIN="$LE_DOMAIN"
fi

# Fallback: NEXTAUTH_URL bereits korrekt gesetzt (nicht localhost)
if [[ -z "$NGINX_DOMAIN" ]]; then
  EXISTING=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "")
  if [[ -n "$EXISTING" && "$EXISTING" != *"localhost"* && "$EXISTING" != *"127.0.0.1"* ]]; then
    NGINX_DOMAIN="__skip__"
    success "NEXTAUTH_URL bereits korrekt: $EXISTING"
  fi
fi

echo "  → nginx-Domain erkannt: '${NGINX_DOMAIN:-KEINE}'"

if [[ "$NGINX_DOMAIN" == "__skip__" ]]; then
  : # Bereits oben als korrekt gemeldet
elif [[ -n "$NGINX_DOMAIN" ]]; then
  if [[ -f "/etc/letsencrypt/live/$NGINX_DOMAIN/fullchain.pem" ]]; then
    NEW_URL="https://$NGINX_DOMAIN"
  else
    NEW_URL="http://$NGINX_DOMAIN"
  fi
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "")
  if [[ "$CURRENT_URL" != "$NEW_URL" ]]; then
    # Zeile vorhanden: ersetzen; nicht vorhanden: anhängen
    if grep -q "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null; then
      sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEW_URL|" "$ENV_FILE"
    else
      echo "NEXTAUTH_URL=$NEW_URL" >> "$ENV_FILE"
    fi
    warn "NEXTAUTH_URL aktualisiert: '${CURRENT_URL:-nicht vorhanden}' → $NEW_URL"
  else
    success "NEXTAUTH_URL korrekt: $CURRENT_URL"
  fi
else
  # Kein nginx-Domain gefunden: aktuellen Wert zeigen, aber nicht überschreiben
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "nicht gesetzt")
  if [[ "$CURRENT_URL" == "nicht gesetzt" || "$CURRENT_URL" == *"localhost"* || -z "$CURRENT_URL" ]]; then
    # Letzter Versuch: Domain aus Let's Encrypt-Zertifikaten lesen
    LE_DOMAIN=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -v "README" | head -1 || true)
    if [[ -n "$LE_DOMAIN" ]]; then
      if [[ -f "/etc/letsencrypt/live/$LE_DOMAIN/fullchain.pem" ]]; then
        NEW_URL="https://$LE_DOMAIN"
      else
        NEW_URL="http://$LE_DOMAIN"
      fi
      if grep -q "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEW_URL|" "$ENV_FILE"
      else
        echo "NEXTAUTH_URL=$NEW_URL" >> "$ENV_FILE"
      fi
      warn "NEXTAUTH_URL via Let's Encrypt gesetzt: $NEW_URL"
    else
      warn "NEXTAUTH_URL = '$CURRENT_URL' — Domain konnte nicht automatisch erkannt werden."
      warn "Bitte einmalig setzen: sed -i 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://IHRE_DOMAIN|' $ENV_FILE"
    fi
  else
    success "NEXTAUTH_URL unverändert: $CURRENT_URL"
  fi
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
# Rechnungsvorlage: Status-Badge aus gespeicherten Vorlagen entfernen
sudo -u postgres psql kds_db -c "UPDATE \"InvoiceTemplate\" SET \"htmlContent\" = REPLACE(\"htmlContent\", '<span class=\"badge badge-unpaid\">Offen</span>', '') WHERE \"htmlContent\" LIKE '%badge-unpaid%';" 2>/dev/null || true

# Rechnungsvorlage: erste aktive Vorlage als Standard setzen wenn keine gesetzt ist
sudo -u postgres psql kds_db -c "UPDATE \"InvoiceTemplate\" SET \"isDefault\" = true WHERE id = (SELECT id FROM \"InvoiceTemplate\" WHERE \"isActive\" = true ORDER BY \"createdAt\" ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM \"InvoiceTemplate\" WHERE \"isDefault\" = true AND \"isActive\" = true);" 2>/dev/null || true

# Status-Badge aus gespeicherten Rechnungsvorlagen entfernen
sudo -u postgres psql kds_db -c "UPDATE \"InvoiceTemplate\" SET \"htmlContent\" = REGEXP_REPLACE(\"htmlContent\", \'<tr><td>Status</td><td>[\\s\\S]*?</td></tr>\', \'\', \'g\') WHERE \"htmlContent\" LIKE '%Status</td><td>%';" 2>/dev/null || true

sudo -u postgres psql kds_db -c "DELETE FROM \"InvoiceDocument\" WHERE \"deletedAt\" IS NULL AND id NOT IN (SELECT DISTINCT ON (\"transactionId\") id FROM \"InvoiceDocument\" WHERE \"deletedAt\" IS NULL ORDER BY \"transactionId\", \"createdAt\" DESC);" 2>/dev/null || true
sudo -u postgres psql kds_db -c "UPDATE \"TherapySession\" SET name = REGEXP_REPLACE(name, '^Session-0*([0-9]+)', \'Sitzung-\\1\') WHERE name ~ '^Session-[0-9]+';" 2>/dev/null || true

# ─── 5b. System-Pakete (idempotent) ───────────────────────────────────────────
# unrar wird für den TheraPsy-Migrationsbereich benötigt (RAR-Export-Dateien)
step "System-Pakete sicherstellen (unrar)"
apt-get install -y -qq unrar 2>/dev/null && success "unrar verfügbar" || warn "unrar konnte nicht installiert werden"

# ─── 5c. Backup-Verzeichnis ────────────────────────────────────────────────────
# Idempotent (sicher bei jedem Update erneut auszuführen). Notwendig, weil der
# Cron-Job als postgres läuft, der manuelle "Backup erstellen"-Button in der
# Web-UI aber als $APP_USER - ohne gemeinsame Gruppe: EACCES beim manuellen Backup.
# ─── 5a. System-Pakete prüfen ──────────────────────────────────────────────────
step "System-Pakete: unrar sicherstellen (benötigt für TheraPsy-Migration)"
dpkg -s unrar &>/dev/null || apt-get install -y -qq unrar 2>/dev/null || true
success "unrar verfügbar"

step "Backup-Verzeichnis: Berechtigungen sicherstellen"
BACKUP_DIR="/var/backups/kds"
mkdir -p "$BACKUP_DIR"
groupadd -f kds-backup
usermod -aG kds-backup "$APP_USER"
usermod -aG kds-backup postgres
chgrp kds-backup "$BACKUP_DIR"
chmod 2775 "$BACKUP_DIR"
success "Backup-Verzeichnis OK (Gruppe kds-backup, Setgid)"

# ─── 5d. Nginx: client_max_body_size sicherstellen ────────────────────────────
# Größere Migrations-Importe (Rechnungsanhänge etc.) können mehrere MB an
# JSON-Payload erzeugen. install.sh setzt client_max_body_size 50M bei
# Neuinstallation — bestehende Server (installiert vor dieser Zeile) haben das
# u.U. nicht und lehnen den Request am Proxy mit 413 ab, bevor er überhaupt bei
# Next.js ankommt (kein Log in journalctl -u kds). Idempotent nachrüsten.
step "Nginx: client_max_body_size prüfen"
# Dateiname ist NICHT garantiert "kds" (auf diesem Server z.B. "scl90s" — vermutlich
# durch manuelles Setup/Rename entstanden). Daher über den tatsächlichen Proxy-Port
# suchen statt einen festen Dateinamen anzunehmen.
# WICHTIG: sites-enabled/X ist NICHT zwingend ein Symlink auf sites-available/X —
# auf diesem Server sind es zwei unabhängige Dateien. Beide Verzeichnisse durchsuchen
# und JEDE Fundstelle patchen, sonst greift die Änderung nicht am tatsächlich aktiven VHost.
NGINX_CONFS=$(grep -rl "proxy_pass http://127.0.0.1:${APP_PORT:-3000}" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | sort -u || true)
if [[ -n "$NGINX_CONFS" ]]; then
  CHANGED=0
  while IFS= read -r conf; do
    # Bei echten Symlinks (sites-enabled -> sites-available) ist die Datei nach dem
    # ersten Patch-Durchlauf schon geändert; der grep-Check hier überspringt sie dann
    # beim zweiten Fund automatisch — kein doppeltes Einfügen.
    if ! grep -q "client_max_body_size" "$conf"; then
      sed -i '/proxy_cache_bypass \$http_upgrade;/a\        client_max_body_size 50M;' "$conf"
      CHANGED=1
      info "client_max_body_size 50M ergänzt in $conf"
    fi
  done <<< "$NGINX_CONFS"
  if [[ "$CHANGED" == "1" ]]; then
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      success "nginx neu geladen"
    else
      warn "nginx-Konfig nach Ergänzung ungültig — bitte manuell prüfen"
    fi
  else
    success "client_max_body_size bereits überall gesetzt"
  fi
else
  warn "Keine nginx-Konfig mit proxy_pass auf Port ${APP_PORT:-3000} gefunden — client_max_body_size übersprungen, bitte manuell prüfen"
fi

# ─── 5e. systemd: korrekten pnpm-Pfad sicherstellen ───────────────────────────
# install.sh hat früher /usr/local/bin/pnpm fix angenommen — auf manchen Systemen
# (je nach Node/pnpm-Installationsart) liegt pnpm woanders (z.B. /usr/bin/pnpm),
# was den Service mit "203/EXEC" endlos crashen lässt. Idempotent korrigieren.
step "systemd: pnpm-Pfad im kds.service prüfen"
KDS_SERVICE_FILE="/etc/systemd/system/${SERVICE}.service"
ACTUAL_PNPM_BIN=$(command -v pnpm || true)
if [[ -f "$KDS_SERVICE_FILE" && -n "$ACTUAL_PNPM_BIN" ]] && ! grep -q "ExecStart=${ACTUAL_PNPM_BIN} start\|ExecStart=/usr/bin/env pnpm start" "$KDS_SERVICE_FILE"; then
  sed -i "s|^ExecStart=.*pnpm start|ExecStart=${ACTUAL_PNPM_BIN} start|" "$KDS_SERVICE_FILE"
  systemctl daemon-reload
  success "ExecStart korrigiert auf ${ACTUAL_PNPM_BIN} (Service wird beim nächsten Schritt neu gestartet)"
elif [[ -f "$KDS_SERVICE_FILE" ]]; then
  success "pnpm-Pfad im Service bereits korrekt"
fi

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

# Locale-Override sicherstellen (UTF-8-Dateinamen bei RAR/ZIP-Extraktion, z.B. TheraPsy-Migration)
# Idempotent: wird bei jedem Deploy geprüft/angelegt, übersteht daher auch VM-Snapshot-Rollbacks
LOCALE_DROPIN="/etc/systemd/system/${SERVICE}.service.d/locale.conf"
if [ ! -f "$LOCALE_DROPIN" ]; then
  mkdir -p "$(dirname "$LOCALE_DROPIN")"
  printf '[Service]\nEnvironment=LANG=C.UTF-8\nEnvironment=LC_ALL=C.UTF-8\n' > "$LOCALE_DROPIN"
  systemctl daemon-reload
fi

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
