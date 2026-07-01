KDS – Session-Log Teil 8 (30.6./1.7.2026)
Letzter Commit: 199305f

STACK / INFRA (unverändert)
Next.js 14, PostgreSQL 16, Prisma 5.22, NextAuth v4, pnpm 9, Node.js 22
Server: 192.168.0.79, /opt/kds, User kds, Service kds
Deploy: sudo bash /opt/kds/update.sh (hat exec-Selbstschutz seit 09f16e3)
GitHub: hwutti/scl90-s

DIESE SESSION – FERTIG

Fixes (alle committed + deployed):
- Unterschrift/Stempel in allen 3 Vorlagen-Routen (ALLOWED_FIELDS fehlte)
- Signaturlinie unter Unterschrift in Honorarnote
- Sidebar Administration: echter Klick-Toggle (vorher nur route-basiert)
- Backup-Rechte: kds-backup Gruppe mit Setgid in install.sh UND update.sh
- update.sh Selbst-Überschreibungs-Bug: exec+KDS_UPDATED nach git pull
- USt-Satz-Feld in BMD-Kontozuordnung entfernt (war ungenutzt, verwirrend)

Features:
- BMD-Export Tab in Finanzen (CSV, Semikolon, UTF-8, konfigurierbare Konten)
- Einnahmen-Ausgaben-Aufstellung PDF (für Steuerberater/Finanzamt)
  → USt-Aufteilung (§6 Abs1 Z19 UStG), Rechnungsjournal mit Opt. Anonymisierung
  → GET /api/finance/profit-statement/export?year=X&anonymize=true|false
  → GET /api/finance/bmd-export?year=X&anonymize=true|false
- Anonymisierung: Patient.codeName (KL-XXX), stabil+persistent, Checkbox in UI
- Mahnwesen Tab in Finanzen
  → 3 Stufen: Erinnerung → 1. Mahnung → 2. Mahnung, keine Gebühren
  → System schlägt vor, Versand erst nach manueller Bestätigung
  → PDF-Archiv (immutable Dunning-Model), optional E-Mail-Versand
  → Konfigurierbare Fristen (Default 7/14/14 Tage) in PraxisConfig.dunningSettings
- TheraPsy-Migration unter Administration → TheraPsy-Migration
  → Alle TheraPsy-Bereiche sichtbar (auch leere mit Erklärung)
  → Wizard: Upload/Server-Pfad → Vorschau → Import → Ergebnis
  → Server-Pfad-Import: GET /api/admin/migration/parse?serverPath=/tmp/...
    (empfohlen, da Next.js formData-Limit ~4MB für Route Handlers)
  → Deduplizierung über codeName (Patienten) + name+patient (Sitzungen)
  → MigrationRun-Protokoll verhindert stille Doppelimporte
- Audio-Aufnahmen (Browser-Aufnahme + Upload, AES-256-GCM verschlüsselt)
  → Noch nicht vollständig end-to-end getestet

PENDING / OFFEN

TheraPsy-Migration letzte Meile:
- xlsx-Bundling-Fix (serverComponentsExternalPackages) deployed, noch nicht bestätigt
- Wenn noch Fehler: journalctl -u kds -n 30 für echten Stacktrace
- Die RAR liegt auf dem Server: /tmp/kds-migration-upload.rar
- Falls erfolgreich: Patienten Geburtsdatum + Geschlecht manuell ergänzen
  (TheraPsy exportiert diese Felder nicht → Platzhalter 0000-00-00 / DIVERSE)

Audio-Feature (Fragen noch offen):
- Verschlüsselt: Ja (AES-256 bestätigt)
- Herbert wollte noch was fragen, bevor Antwort: Beides (Browser+Upload), Beides (Session+Patient)
- Feature ist gebaut aber nicht vollständig getestet

E-Mail/SMTP:
- 535 auth failed bei hosttech – Passwort im hosttech-Panel zurücksetzen
- Passwort in KDS danach neu eintragen (/admin/smtp)
- Achtung: SMTP-Passwort in DB aktuell im Klartext – Security-Härtung auf TODO-Liste

Security-Härtung (explizit auf "wenn fertig" verschoben):
- SMTP-Passwort verschlüsseln (AES-256-GCM wie bei FF Görtschach)
- Audit-Log-Review, DSGVO-Checks

WICHTIGE PRISMA-FELDER / SCHEMA-GOTCHAS (Stand 199305f)

Patient: firstName, lastName, dob (String "YYYY-MM-DD"), gender (Gender enum),
  codeName, codeNameAuto, defaultUnitDuration, defaultUnitPriceNet, createdByUserId
  — KEIN importSource, KEIN dateOfBirth

TherapySession: name, sessionNumber, codeName, source (SessionSource), sessionDate,
  durationMinutes, billingMode, serviceLabel, billingStatus (SessionBillingStatus),
  excludedFromFinances, patientId, therapistId
  — billingStatus-Werte: EXCLUDED | UNBILLED | BILLED_UNPAID | PAID

FinanceTransaction (Legacy): createdBy, type, amount, date, paymentStatus, description,
  invoiceNumber, incomeCategory, expenseCategory, patientId
  — KEIN paidAt, KEIN paidDate als Feld

AuditAction neue Werte: BACKUP_CREATED, FINANCE_DATA_EXPORTED, DUNNING_SENT,
  MIGRATION_IMPORT

Neue Modelle: Dunning, MigrationRun, AudioRecording (Schema schon vorhanden)
Neue PraxisConfig-Felder: dunningSettings (JSON), bmdSettings (JSON)

BEKANNTE FALLSTRICKE

xlsx-Paket: muss in serverComponentsExternalPackages stehen (next.config.mjs),
  sonst XLSX.readFile/XLSX.read wirft "Cannot access file" im Production Build
Next.js Route Handler: formData() / arrayBuffer() haben ~4MB Limit in App Router.
  Für große Uploads immer Server-Pfad-Route (GET mit ?serverPath=) verwenden.
unrar: nach Extraktion chmod -R u+rX nötig (Windows-Rechte im RAR)
update.sh überschreibt sich selbst nach git pull → exec+KDS_UPDATED-Flag schützt
PDF-Fonts: Unicode-Minus (−) wird nicht gerendert → einfachen Bindestrich (-) verwenden
SMTP: hosttech-Passwort kann sich serverseitig ändern (Sicherheitsmaßnahme)
