KDS – Session-Log Teil 9 (1.7.2026)
Letzter Commit: a90209d

STACK / INFRA (unverändert)
Next.js 14, PostgreSQL 16, Prisma 5.22, NextAuth v4, pnpm 9, Node.js 22
Server: 192.168.0.79, /opt/kds, User kds, Service kds
Nginx-Config-Datei heißt auf diesem Server "scl90s" (nicht "kds") — sites-enabled/scl90s
  ist KEIN Symlink auf sites-available/scl90s, sondern eine eigenständige Kopie!
Deploy: sudo bash /opt/kds/update.sh (macht git reset --hard origin/main — betrifft nur
  /opt/kds, NICHT /etc/nginx/ o.ä., da außerhalb des Repos)
GitHub: hwutti/scl90-s

DIESE SESSION – FERTIG

TheraPsy-Migration: kompletter Durchbruch, läuft jetzt Ende-zu-Ende
- Root-Cause "Honorarnoten immer leer": XLSX.sheet_to_json() lässt komplett leere
  Excel-Zeilen standardmäßig aus dem Ergebnis-Array weg → alle hartkodierten
  Zeilenpositionen (row 6/7/8/11/17) waren um 1 verschoben. Fix: blankrows:true bei
  JEDEM sheet_to_json-Aufruf im Migrationscode (Sessions- UND Rechnungsparsing).
- Root-Cause "Rechnungen bekommen falschen Zahlungsstatus": Die einzelnen
  Rechnungs-xlsx (Alle_Rechnungen_Einnahmen/) enthalten KEINEN verlässlichen
  Zahlungsstatus — Zeile 46-48 ist nur der wiederholte Zahlschein-Footer
  (IBAN + Fälligkeitsdatum), kein Zahlungsnachweis. Echter Status/Datum + die
  zugehörigen Sitzungsnamen stehen NUR in der Finanzexport-Gesamtübersicht
  ("Finanzen_<von>_bis_<bis>.xlsx", Sheet "Finanzexport"), zwei Blöcke:
    - "Abgeschlossene Transaktionen": Spalte J=Ref.Nr., E=Status
      ("Bezahlt am DD.MM.YYYY" | "Storniert am DD.MM.YYYY" | "Erstellt am DD.MM.YYYY"),
      I=Notiz (enthält Sitzungsnamen-Liste)
    - "Offene Transaktionen": Spalte S=Ref.Nr., O=Status ("Nicht bezahlt"), R=Notiz
  → neue Funktion parseFinanzexportStatus() in therapsyParser.ts gleicht das ab.
- Honorarnoten-Import komplett umgestellt: schreibt jetzt in das ECHTE `Transaction`-
  Modell (+TxLineItem +TxSessionAllocation +InvoiceDocument) statt Legacy
  `FinanceTransaction`. Grund: /api/transactions (Patienten-"Rechnungen"-Tab) liest
  NUR `Transaction`, nicht FinanceTransaction. computeTransactionJournal()
  (BMD-Export, Steuerberater-PDF) liest ohnehin BEIDE zusammen — Umstellung war
  daher gefahrlos möglich. Original-Rechnungs-xlsx wird als InvoiceDocument
  (format: xlsx) am Patienten angehängt (Bytes werden als base64 im
  Preview→Execute-Payload mitgeschleust, da execute keinen Dateisystem-Zugriff
  mehr auf den tmpDir hat).
- Storno-Rechnungen ("Storniert am...") laufen mit lifecycleStatus:CANCELLED_ORIGINAL
  rein → zählen korrekt NICHT in die Einnahmen-Summe (computeTransactionJournal
  filtert auf lifecycleStatus:ACTIVE).

Infra-Fixes (idempotent in install.sh/update.sh, nicht nur Server-Oneliner):
- Locale: kds.service hatte kein LANG/LC_ALL → unrar x scheiterte an Ordnern mit
  Umlauten (z.B. "KäÖs") im TheraPsy-Export. LANG=C.UTF-8/LC_ALL=C.UTF-8 jetzt in
  install.sh (systemd-Template) UND update.sh (idempotenter Dropin,
  /etc/systemd/system/kds.service.d/locale.conf) — übersteht auch VM-Snapshot-Rollbacks.
- nginx client_max_body_size: fehlte auf bestehenden Servern (413 bei Migrations-
  Import mit Rechnungsanhängen, ~1-2MB Payload). update.sh sucht jetzt über den
  proxy_pass-Port (nicht über festen Dateinamen wie "kds") UND patcht sowohl
  sites-available ALS AUCH sites-enabled (keine Symlink-Annahme mehr, siehe INFRA oben).
- pnpm-Pfad: install.sh hatte ExecStart=/usr/local/bin/pnpm hardcodiert → 203/EXEC-
  Crash-Loop auf Systemen, wo npm install -g pnpm woanders installiert (z.B.
  /usr/bin/pnpm). Jetzt: PNPM_BIN=$(command -v pnpm) zur Laufzeit ermittelt
  (install.sh), + idempotente Korrektur in update.sh falls Service falschen
  Pfad hat.
- README.md: Admin-E-Mail war FALSCH dokumentiert (admin@scl90s.local) — tatsächlicher
  Seed-Wert ist admin@kds.local. War Ursache eines "Login schlägt fehl trotz User in DB"
  bei einer Neuinstallation. Korrigiert, Therapeut-Demo-Account ergänzt
  (therapeut@kds.local / Therapeut1234!). Neue Sektion zu Upload-Berechtigungen
  (scp als Login-User → kds kann Datei nicht lesen → chown kds:kds nötig) ergänzt.

Bugfixes (Migrations-Platzhalterdaten):
- RangeError beim Öffnen migrierter Patienten ohne Geburtsdatum (dob="0000-00-00"
  Platzhalter): Intl.DateTimeFormat().format() auf invalidem Date wirft hart,
  toLocaleDateString() dagegen nicht (liefert nur "Invalid Date"-String).
  calcAge()/fmtDate() in PatientRecordClient.tsx + PatientsListClient.tsx jetzt
  mit isNaN-Guards.
- "null Jahre"-Anzeige: separate Stammdaten-Tabellen-Zeile ['Alter', age + ' Jahre']
  hatte den Null-Check vergessen (null + string ergibt in JS wörtlich "null...").

Aufräumen:
- Toter Code entfernt: src/lib/migration/therapsy.ts (alte, ungenutzte
  Parser-Implementierung) + die zwei toten Routen upload/route.ts, run/route.ts,
  die sie importierten. Hatte zu echter Verwirrung geführt (auch bei externer
  KI-Hilfe wurde versehentlich am toten Pfad statt am aktiven
  therapsyParser.ts/therapsyExecutor.ts debuggt).

PENDING / OFFEN

TheraPsy-Migration:
- Erster echter Import mit allen o.g. Fixes lief laut Herbert erfolgreich durch
  (Patienten + Rechnungen vorhanden). Noch nicht im Detail verifiziert: korrekte
  Sitzungs-Verknüpfung (TxSessionAllocation) und Beträge im Patienten-
  "Rechnungen"-Tab stichprobenartig gegenprüfen.
- Wie bisher: Patienten Geburtsdatum + Geschlecht manuell ergänzen (TheraPsy
  exportiert diese Felder nicht → Platzhalter 0000-00-00 / DIVERSE)

Separat aufgefallen, NICHT gefixt (kein Zusammenhang mit Migration):
- Dashboard (/api/dashboard/route.ts): verschachtelte prisma.$queryRaw-Template-
  Literals (Zeile ~44-51, Activity-Chart-Query) ergeben ungültiges SQL
  ("Syntaxfehler bei »$1«"). Läuft in .catch(() => []) auf, daher kein harter
  Crash, aber die "letzte 14 Tage"-Aktivitätsgrafik im Dashboard liefert immer
  leere Daten.

Audio-Feature (wie bisher offen):
- Verschlüsselt: Ja (AES-256 bestätigt)
- Herbert wollte noch was fragen, bevor Antwort: Beides (Browser+Upload), Beides
  (Session+Patient)
- Feature ist gebaut aber nicht vollständig getestet

E-Mail/SMTP (wie bisher offen):
- SMTP-Passwort in DB aktuell im Klartext – Security-Härtung auf TODO-Liste

Security-Härtung (wie bisher, "wenn fertig" verschoben):
- SMTP-Passwort verschlüsseln (AES-256-GCM wie bei FF Görtschach)
- Audit-Log-Review, DSGVO-Checks

WICHTIGE PRISMA-FELDER / SCHEMA-GOTCHAS (Ergänzung zu Teil 8, Stand a90209d)

Transaction (NEU, nicht Legacy!): patientId, createdByUserId, direction (TxDirection:
  INCOME|EXPENSE), sourceType (TxSourceType: SESSION|MANUAL|TRAVEL|CANCELLATION|
  CORRECTION), referenceNumber (@unique — KDS-eigenes Format "RE-2026-0001" via
  reserveReferenceNumber(), kollidiert nicht mit TheraPsy-Format "E26001"),
  payerName, payeeName, amountNet/vatRate/vatAmount/amountGross (Psychotherapie
  = umsatzsteuerbefreit §6 Abs1 Z19 UStG → vatRate=0), paymentStatus
  (TxPaymentStatus: NUR UNPAID|PAID — KEIN CANCELLED!), paidAt, paymentMethod
  (TxPaymentMethod), lifecycleStatus (TxLifecycleStatus: ACTIVE|UNDONE|
  CANCELLED_ORIGINAL|CANCELLATION_TX — Stornos hier abbilden, nicht über
  paymentStatus), notes
TxLineItem: transactionId, description, quantity, unitPriceNet, amountNet, vatRate,
  vatAmount, amountGross, lineDate
TxSessionAllocation: transactionId, lineItemId, sessionId, allocationPercentage,
  allocatedAmountNet, allocatedVatAmount, allocatedAmountGross
InvoiceDocument: transactionId, documentType (InvoiceDocumentType), format
  (pdf|xlsx|image), data (Bytes), mimeType
computeTransactionJournal() (src/lib/finance/transactionJournal.ts, Basis für
  BMD-Export + Steuerberater-PDF) liest Transaction UND FinanceTransaction
  zusammen und filtert Transaction auf lifecycleStatus:ACTIVE — beide Modelle
  daher unbedenklich parallel nutzbar, kein Doppel-Count-Risiko solange man
  konsistent bleibt (Honorarnoten → Transaction, BMD-Rohbuchungen → weiterhin
  FinanceTransaction Legacy).

BEKANNTE FALLSTRICKE (Ergänzung zu Teil 8)

XLSX.sheet_to_json() lässt komplett leere Zeilen standardmäßig aus dem
  Ergebnis-Array weg → verschiebt alle nachfolgenden hartkodierten
  Zeilenindizes. IMMER { blankrows: true } setzen, wenn per fester
  Zeilennummer (raw[row-1]) auf Zellen zugegriffen wird.
sites-enabled/X ist NICHT garantiert ein Symlink auf sites-available/X — auf
  diesem Server sind es unabhängige Kopien. Änderungen an nginx-Configs müssen
  beide Orte prüfen/patchen, sonst greift die Änderung am tatsächlich aktiven
  VHost nicht (nginx -t + reload melden trotzdem Erfolg!).
pnpm-Installationspfad variiert je nach System (npm install -g pnpm landet nicht
  immer unter /usr/local/bin) — im systemd-ExecStart nie hardcoden, sondern
  command -v pnpm zur Install-Zeit ermitteln.
Next.js API Route Handler (POST mit request.json(), kein formData()) haben KEIN
  eingebautes 4MB-Limit wie Pages-Router — der Flaschenhals ist stattdessen der
  vorgelagerte nginx-Proxy (client_max_body_size, Default oft 1MB). Führt zu
  HTTP 413 mit HTML-Fehlerseite statt JSON — im Next.js/journalctl-Log erscheint
  dazu GAR NICHTS, da die Anfrage nginx nie in Richtung App verlässt. Bei
  "Server-Fehler" ohne jeden Log-Eintrag: zuerst Browser-Netzwerk-Tab / Status-Code
  prüfen (413?), dann nginx-Logs, bevor man im App-Code sucht.

--------------------------------------------------------------------

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
