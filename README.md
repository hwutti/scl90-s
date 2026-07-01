# KDS – Klinisches Dokumentationssystem

Vollständiges klinisches Dokumentations-, Praxisverwaltungs- und Abrechnungssystem für Psychotherapie-Praxen.

## Einzeiler-Installation (Ubuntu 22.04 / 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/hwutti/scl90-s/main/install.sh | sudo bash
```

## Voraussetzungen

- Ubuntu 22.04 LTS oder 24.04 LTS
- Root-Zugriff oder sudo
- Öffentliche IP oder Domain (optional für SSL)
- Min. 2 GB RAM, 10 GB Speicher

## Was der Installer macht

1. Node.js 22, pnpm 9, PostgreSQL 16, Nginx installieren
2. DB-User `kds_user` und Datenbank `kds_db` anlegen (idempotent)
3. `.env` mit sicheren zufälligen Secrets erstellen
4. `pnpm install --frozen-lockfile` (pnpm-lock.yaml muss vorhanden sein)
5. `prisma validate` → `prisma generate` → `prisma db push`
6. Tabellen prüfen (`User`, `Patient`, `TherapySession`, `Transaction`)
7. Seed: Admin-User + Demo-Daten anlegen
8. Next.js Production-Build
9. systemd-Service `kds` starten
10. Nginx konfigurieren
11. Healthcheck gegen Port 3000

## Standardzugangsdaten

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| Admin | `admin@kds.local` | `Admin1234!` |
| Therapeut (Demo) | `therapeut@kds.local` | `Therapeut1234!` |

URL: `http://SERVER-IP` oder `https://DOMAIN`

**Passwort nach erstem Login ändern!**

## Update

```bash
sudo bash /opt/kds/update.sh
```

Automatisch: git pull → pnpm install → prisma generate → db push → seed → build → restart → healthcheck

## Logs & Diagnose

```bash
# Service-Status
sudo systemctl status kds

# Live-Log
sudo journalctl -u kds -f

# Installationslog
cat /var/log/kds-install.log

# Datenbankverbindung testen
sudo -u kds psql -U kds_user -h localhost kds_db -c "SELECT COUNT(*) FROM \"User\";"

# Nginx testen
sudo nginx -t
```

## Reparatur / Neustart bei Fehler

```bash
# Service neu starten
sudo systemctl restart kds

# Schema neu anwenden
sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx prisma db push --accept-data-loss"

# Seed erneut ausführen
sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx prisma/seed.ts"

# Build wiederholen
sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && pnpm build"
```

## PostgreSQL-Berechtigungen (bei Problemen)

```bash
sudo -u postgres psql kds_db << 'SQL'
GRANT ALL PRIVILEGES ON DATABASE kds_db TO kds_user;
GRANT ALL ON SCHEMA public TO kds_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kds_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kds_user;
ALTER ROLE kds_user SUPERUSER;
SQL
```

## TheraPsy-Migration: Datei-Upload per scp

Der Service läuft als Betriebssystem-User `kds`, nicht als der Login-User (z.B. `hwutti`).
Wird eine Export-Datei per `scp` als Login-User hochgeladen, gehört sie diesem User —
`kds` kann sie ohne Rechte-Anpassung nicht lesen:

```bash
scp export.rar dein-user@server:/tmp/kds-migration-upload.rar
sudo chown kds:kds /tmp/kds-migration-upload.rar
sudo chmod 644 /tmp/kds-migration-upload.rar
```

Erst danach in der Anwendung unter Administration → TheraPsy-Migration →
Server-Pfad `/tmp/kds-migration-upload.rar` eingeben.

## Tech-Stack

- **Next.js 14** (App Router)
- **PostgreSQL 16** + **Prisma 5**
- **NextAuth v4**
- **Tailwind CSS** + **Recharts**
- **pnpm 9** + **Node.js 22**

## Seed-Daten

Der Seed enthält ausschließlich anonyme Demo-Daten:
- Admin-User: `admin@kds.local`
- Demo-Therapeut: `therapeut@kds.local`
- Demo-Patient: `Demo Patient` (kein realer Name)

**Keine realen Personennamen werden als Demo-Daten verwendet.**

## Hinweise

- `.env` enthält Secrets und hat `chmod 600`
- DB-Passwort wird bei Erstinstallation zufällig generiert
- Bei Wiederholung des Installers wird bestehende `.env` wiederverwendet
- Installer ist idempotent: kann mehrfach sicher ausgeführt werden
- Backups täglich um 02:00 Uhr nach `/var/backups/kds/`
