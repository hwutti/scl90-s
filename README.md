# KDS – Klinisches Dokumentationssystem

Klinisches Dokumentationssystem für Psychotherapie und Rehabilitation.
Erstes Instrument: SCL-90-S (Symptom-Checkliste 90 Standard, Franke 2014).

---

## Stack

| Komponente | Version |
|---|---|
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript |
| Datenbank | PostgreSQL 16 |
| ORM | Prisma 5.22 |
| Auth | NextAuth v4 (JWT, Email/Passwort + 6-stelliger PIN) |
| Paketmanager | pnpm 9 |
| Node.js | 22 |
| CSS | Tailwind CSS |
| Charts | Recharts |
| PDF | @react-pdf/renderer |
| Icons | Lucide React |

---

## Server-Infrastruktur

| | |
|---|---|
| **Server** | Ubuntu 24.04 |
| **IP** | 192.168.0.79 |
| **App-Verzeichnis** | `/opt/kds` |
| **System-User** | `kds` |
| **systemd Service** | `kds` |
| **Port** | 3000 (intern), über Nginx auf 80/443 |
| **Datenbank** | `kds_db` |
| **DB-User** | `kds_user` |

---

## GitHub

- **Repo:** https://github.com/hwutti/scl90-s
- **Token:** `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Clone:** `git clone https://hwutti:GITHUB_TOKEN@github.com/hwutti/scl90-s.git`

---

## Standard-Zugangsdaten (nach Seed)

| Rolle | E-Mail | Passwort | PIN |
|---|---|---|---|
| Admin | admin@kds.local | PASSWORT_BEIM_ERSTEN_LOGIN_ÄNDERN | — |
| Therapeut | therapeut@kds.local | PASSWORT_BEIM_ERSTEN_LOGIN_ÄNDERN | — |
| Patient (Demo) | — | — | 123456 |

---

## Update (nach Code-Änderungen)

```bash
sudo bash /opt/kds/update.sh
```

Das Script macht automatisch:
1. `git pull` (reset + pull)
2. NEXTAUTH_URL aus Nginx-Config lesen und setzen
3. `pnpm install`
4. `prisma generate`
5. `prisma db push --accept-data-loss` (neue Tabellen, kein Datenverlust)
6. Seed wenn Tabellen leer (Instrument, AppointmentType, PraxisConfig)
7. `pnpm build` (bei Fehler: Service wird NICHT neu gestartet)
8. `systemctl restart kds`
9. Healthcheck

---

## Wichtige Konfigurationsdateien

### /opt/kds/.env
```
DATABASE_URL=postgresql://kds_user:PASSWORT@localhost:5432/kds_db
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://scl90s.psychotherapie-wutti.at   # http:// wegen Nginx-Proxy!
NODE_ENV=production
APP_PORT=3000
ENCRYPTION_KEY=...
```

**Wichtig:** `NEXTAUTH_URL` muss `http://` (nicht `https://`) sein weil die App
hinter Nginx läuft. Nginx übernimmt HTTPS nach außen.

### /etc/systemd/system/kds.service
```ini
[Unit]
Description=KDS – Klinisches Dokumentationssystem
After=network.target postgresql.service

[Service]
Type=simple
User=kds
WorkingDirectory=/opt/kds
EnvironmentFile=/opt/kds/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Nginx Proxy Manager

Domain: `scl90s.psychotherapie-wutti.at`
- Scheme: `http`
- Forward Hostname: `192.168.0.79`
- Forward Port: `80`
- Cache Assets: **AUS** (wichtig!)
- Websockets: Ein

Custom Nginx Config (Advanced):
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header Host $host;
```

---

## Bekannte Probleme & Lösungen

### Login funktioniert nicht
→ `NEXTAUTH_URL` prüfen: muss `http://` sein (nicht `https://`)
→ Cache Assets im Nginx Proxy Manager **ausschalten**
→ `sudo systemctl restart kds`

### JS-Dateien 404
→ Cache Assets im Nginx Proxy Manager **ausschalten**
→ Inkognito-Fenster öffnen

### Schema-Migration schlägt fehl
→ `sudo -u postgres psql kds_db -c "GRANT ALL ON SCHEMA public TO kds_user; GRANT ALL ON ALL TABLES IN SCHEMA public TO kds_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO kds_user;"`

### Service startet nicht
→ `sudo journalctl -u kds -n 50 --no-pager`

---

## Prisma Schema – Modelle

| Modell | Beschreibung |
|---|---|
| User | Auth (Admin/Therapeut/Patient) |
| Patient | Patientenstammdaten |
| PatientRecord | Klinische Akte (Anamnese, Diagnosen ICD-10, Therapieziele) |
| TherapistPatient | Therapeut↔Patient Relation |
| Instrument | Testinstrumente (SCL90S, erweiterbar) |
| Assessment | Einzelerhebung (Patient + Instrument) |
| Answer | Itemantworten |
| AssessmentResult | Scoring-Ergebnisse (JSON, flexibel) |
| SessionNote | Verlaufsnotizen (§16a PThG) |
| AppointmentType | Terminarten (konfigurierbar) |
| Appointment | Einzeltermin |
| RecurringRule | Terminserie |
| AvailabilitySlot | Verfügbarkeit Therapeut |
| Absence | Urlaub/Abwesenheit |
| WaitlistEntry | Warteliste |
| Notification | In-App/E-Mail/SMS Benachrichtigungen |
| NotificationSetting | Kanaleinstellungen pro User |
| NormTable | SCL-90-S Normtabellen (Franke 2014) |
| PraxisConfig | Branding (Name, Logo, Farben, Bundesland) |
| AuditLog | DSGVO Art. 30 Audit-Log |

---

## Rollen & Zugriffsrechte

| Route | Admin | Therapeut | Patient |
|---|---|---|---|
| /patients | ✓ | ✓ (eigene) | ✗ |
| /patients/[id] | ✓ | ✓ (eigene) | ✗ |
| /calendar | ✓ | ✓ | ✗ |
| /my | ✗ | ✗ | ✓ |
| /my/appointments | ✗ | ✗ | ✓ |
| /admin/branding | ✓ | ✗ | ✗ |
| /admin/users | ✓ | ✓ | ✗ |
| /admin/appointment-types | ✓ | ✓ | ✗ |
| /admin/availability | ✓ | ✓ | ✗ |

---

## Gesetzliche Anforderungen (AT)

- **§16a Psychotherapiegesetz:** Verlaufsnotizen, 10 Jahre Aufbewahrungspflicht
- **DSGVO Art. 9:** Gesundheitsdaten = besondere Kategorie → AuditLog
- **Soft-Delete:** Patienten werden nie wirklich gelöscht (deletedAt)
- **Einsichtsrecht:** Patienten sehen eigene Befunde, nicht Therapeuten-Notizen

---

## Neue Features hinzufügen

### Neues Testinstrument (z.B. BDI-II)
1. `Instrument` in DB anlegen (code, name, itemCount)
2. Scoring-Funktion in `src/lib/scoring-bdi.ts`
3. `AssessmentResult.scores` JSON speichert Ergebnis flexibel
4. PDF-Template in `src/lib/pdf/BdiPdf.tsx`

### Neues Bundesland für Schulferien
→ `src/lib/holidays.ts` → `SCHOOL_HOLIDAYS` Objekt erweitern

---

## Logs & Debugging

```bash
# Service-Logs
sudo journalctl -u kds -f

# Letzten 50 Zeilen
sudo journalctl -u kds -n 50 --no-pager

# Datenbank direkt
sudo -u postgres psql kds_db

# .env ansehen
sudo cat /opt/kds/.env

# Service-Status
sudo systemctl status kds
```

---

## Backup

Automatische PostgreSQL-Backups laufen täglich via Cron.
Backup-Verzeichnis: `/var/backups/kds/`

Manuelles Backup:
```bash
sudo -u postgres pg_dump kds_db > /tmp/kds_backup_$(date +%Y%m%d).sql
```

---

## Alter Service (Backup)

Der alte `scl90s` Service und `/opt/scl90s` Verzeichnis sind noch vorhanden.
Nach Überprüfung aufräumen mit:
```bash
sudo systemctl disable scl90s
sudo rm -rf /opt/scl90s
```
