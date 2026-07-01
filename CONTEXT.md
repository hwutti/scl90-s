KDS – Session-Log Teil 11 (1.7.2026)
Letzter Commit: a1287834dc35424a92cdd5458221a27d5448fc7d

STACK / INFRA (unverändert, siehe Teil 9/10)
NEU: @dicebear/core@^10.2.0 + @dicebear/styles@^10.2.0 als Dependency
  (Avatar-Feature, siehe unten). WICHTIG bei diesen Paketen: @dicebear/styles
  ist NICHT immer versionsgleich zu @dicebear/core — vor jedem Update prüfen
  (npm view @dicebear/styles dist-tags), ob "latest" wirklich zusammenpasst,
  sonst schlägt pnpm install fehl (ETARGET). "next"-Tag ist ein Prerelease,
  nicht verwenden.

DIESE SESSION – FERTIG

===== TEIL A: Finanz-Analyse, Bereinigung, Vereinheitlichung =====
(vollständige technische Analyse auf Anfrage Herbert, dann Fixes + Umbau)

1) Vollständige Code-Analyse der Finanzmigration ergab Doppelzählungs-Bug:
   TheraPsy-Migration schrieb Honorarnoten in ZWEI parallele Modelle
   (Transaction UND FinanceTransaction). computeTransactionJournal() summierte
   beide ohne Belegnummern-Abgleich → BMD-Export + Steuerberater-PDF zeigten
   Beträge doppelt.
2) scripts/finance-diagnose.ts gebaut (rein lesend), am echten Server
   verifiziert: 42 doppelt erfasste Belegnummern, 3.177,80€ zu hohe Reports,
   Math.abs()-Bug bei Stornos bestätigt (Vorzeichen wurde vernichtet),
   E26043-Kollision gefunden (echte Rechnung + Privateinlage zufällig gleiche
   Belegnummer).
3) Root-Cause-Fixes: Bug A (Konto-2xxx fälschlich als Einnahme klassifiziert,
   therapsyParser.ts), Bug B (Math.abs() vernichtete Storno-Vorzeichen,
   therapsyExecutor.ts).
4) scripts/finance-cleanup.ts gebaut + am Server ausgeführt: 45 Duplikate
   gelöscht, E26043 zu "E26043-PRIVATEINLAGE" umbenannt. Diagnose danach:
   0 Überschneidungen, Summen stimmen.
5) Herbert wollte "echte Vereinheitlichung" statt nur Bugfix → komplette
   Konsolidierung von FinanceTransaction (Legacy) auf Transaction:
   - Transaction bekam neues Feld `category` (additiv, via normalem
     prisma db push in update.sh übernommen)
   - therapsyExecutor.ts Schritt 4 (BMD-Import) schreibt jetzt Transaction+
     TxLineItem statt FinanceTransaction
   - transactionJournal.ts + profitStatement.ts: legacyTxs-Merge komplett
     entfernt, Transaction ist einzige Quelle
   - FinanceClient.tsx: Einnahmen UND Ausgaben laufen jetzt beide über
     /api/transactions (+/api/transactions/manual), Hard-Delete bei Ausgaben
     durch Storno ersetzt (cancelTransaction(), war schon direction-agnostisch)
   - Tote Routen /api/finance/transactions + /api/finance/transactions/[id]
     gelöscht
   - scripts/legacy-financetransaction-migrate.ts gebaut + am Server
     ausgeführt: verbleibende FinanceTransaction-Zeilen (16 Ausgaben + Reste)
     nach Transaction übernommen. FinanceTransaction-Tabelle bleibt als
     Sicherheitsnetz bestehen (nicht gelöscht), wird aber von keinem
     Code-Pfad mehr aktiv beschrieben oder gelesen.
   ✅ BESTÄTIGT von Herbert: Deploy + beide Scripts liefen erfolgreich durch.

6) Nebenbei gefunden + gefixt: Patient-Bearbeiten-Button tat nichts bei
   migrierten Patienten ohne Einheitenpreis. Ursache: parseFloat('') = NaN,
   an Prisma-Decimal-Feld übergeben crashte den KOMPLETTEN PATCH-Request
   (auch Vorname/Nachname wurden dadurch nicht gespeichert). Fix:
   src/app/api/patients/[id]/route.ts (NaN→null statt Crash) +
   PatientRecordClient.tsx saveStamm() zeigt jetzt Fehler an statt bei
   Fehlschlag das Formular stillschweigend zu schließen.

===== TEIL B: Avatar-Feature (komplett neu) =====

Ausgangslage: handgezeichnete Cartoon-Gesichter (FigureIcon/GroupIcon in
PatientsListClient.tsx + dritte Variante im Banner von PatientRecordClient.tsx)
gefielen Herbert nicht (zu abstrakt/kühl bei ersten KI-generierten SVG-Versuchen,
dann zu unpersönlich). Referenzbild zeigte den bekannten "DiceBear Avataaars"-
Stil (flache Business-Avatare, grauer Kreis-Hintergrund) — das wurde umgesetzt.

Architektur-Entscheidung: NICHT pro Patient automatisch generiert, sondern
GLOBAL einmalig unter Einstellungen je Gruppe festgelegt (Männlich, Weiblich,
Divers, Paar, Familie, Gruppe) — alle Patient:innen einer Gruppe zeigen
denselben Avatar.

Technisch:
- @dicebear/core + @dicebear/styles (npm), NUR serverseitig verwendet (fs.
  readFileSync statt ESM-JSON-Import mit "with {type:'json'}" — letzteres ist
  zwar in Node 22 nativ ok, aber riskant bzgl. Next.js/Webpack-Bundler-
  Kompatibilität; fs-Ansatz ist Modul-System-unabhängig und getestet stabil)
- Prisma: PraxisConfig.avatarSettings (String?, JSON) — neues Feld, additiv
- src/lib/avatarSettings.ts: parseAvatarSettings/DEFAULT_AVATAR_SETTINGS
  (Muster wie bmdSettings/categoryLabels.ts), generateAvatarSvg (1 Person),
  generateGroupAvatarSvg (2-4 Personen kombiniert, siehe unten)
- GET /api/settings/avatars (+PATCH, admin-only, +DELETE) — Muster wie
  /api/finance/bmd-settings
- GET /api/avatar?seed=X (1 Person) oder ?seeds=a,b,c (mehrere Personen,
  kombiniert) — liefert fertiges SVG, cachebar über die URL selbst
- Einstellungen → neue Section "Avatare": pro Gruppe 12 Kachel-Optionen zum
  Direkt-Anklicken (nicht "Würfeln" — war Herberts explizite Anforderung,
  erst Würfeln-Button gebaut, dann auf Grid umgestellt weil "zu wenig"
  Auswahl auf einmal sichtbar war), "Mehr laden" für weitere 12
- PatientsListClient.tsx + PatientRecordClient.tsx: FigureIcon/GroupIcon/dritte
  Banner-SVG-Variante komplett entfernt (toter Code), ersetzt durch
  <img src="/api/avatar?...">, avatarSeeds per useEffect vom Server geholt

WICHTIGER TEILSCHRITT — Mehrpersonen-Gruppen (Paar/Familie/Gruppe):
DiceBear Avataaars zeichnet IMMER nur eine einzelne Person. Für Paar/Familie/
Gruppe ist ein Einzelgesicht semantisch falsch (Herbert hat das im Screenshot
bemerkt: "paar ist ein Problem" / "familie und gruppe auch"). Lösung:
- Seed-Wert für diese 3 Gruppen ist eine KOMMAGETRENNTE LISTE mehrerer
  Personen-Seeds (z.B. "seedA,seedB" für ein Paar) — landet in derselben
  DB-Spalte (avatarSettings JSON), keine Schema-Änderung nötig
- generateGroupAvatarSvg() nested mehrere einzelne Avataaars-SVGs per <g
  transform="translate(x,y) scale(s)"> in ein gemeinsames SVG mit Kreis-
  Clip-Path. KRITISCH: idRandomization:true beim Erzeugen jedes Einzel-
  Avatars ist zwingend nötig — sonst haben alle Avatare dieselben internen
  <defs>-IDs (Kleidung/Frisur/etc.) und überschreiben sich beim Verschachteln
  gegenseitig (getestet und bestätigt, ohne die Option kollidieren die IDs).
- Layout-Koordinaten für 2/3/4 Personen in GROUP_LAYOUTS (avatarSettings.ts)
  — 280×280 Canvas passend zur nativen Avataaars-viewBox
- /api/avatar erkennt automatisch seed vs. seeds Query-Param
- Einstellungen-UI: bei Paar/Familie/Gruppe kein einzelnes 12er-Grid mehr,
  sondern PRO PERSON ein eigenes Mini-Grid ("Person 1", "Person 2", ...) mit
  eigenem "Mehr laden" + Live-Vorschau-Icon der fertigen Kombination oben
  neben dem Gruppennamen
- Ergebnis mit cairosvg lokal zu PNG gerendert und Herbert vor dem Einbau
  gezeigt (3 Beispielbilder Paar/Familie/Gruppe) — bestätigt, dann umgesetzt
✅ Von Herbert noch NICHT bestätigt ob nach Deploy alles wie gewünscht
  aussieht (Umbau lief bis Sessionende ohne Rückmeldung durch).

PENDING / OFFEN

- Avatar-Feature: Herbert muss nach `update.sh` noch bestätigen, dass Paar/
  Familie/Gruppe-Kombinationen in der Praxis gut aussehen (Layout ggf.
  nachjustieren falls Überlappung/Anordnung nicht passt — GROUP_LAYOUTS in
  src/lib/avatarSettings.ts ist der Ort dafür).
- FinanceTransaction-Tabelle könnte langfristig (nach Beobachtungszeit) per
  Schema-Migration ganz entfernt werden. Bewusst nicht in dieser Session
  gemacht (Sicherheitsnetz).
- Wie bisher: Audio-Feature-Fragen offen, SMTP-Verschlüsselung offen,
  Dashboard verschachtelte $queryRaw-Template-Literals (Aktivitäts-Chart
  liefert leere Daten, unkritisch, nicht gefixt).

WICHTIGE PRISMA-FELDER / SCHEMA-GOTCHAS (Ergänzung, Stand a1287834)

Transaction.category (aus Teil 10): String? — Kategorie-Code, ersetzt
  FinanceTransaction.incomeCategory/expenseCategory funktional.
PraxisConfig.avatarSettings (NEU): String? (JSON) — { seeds: { MALE, FEMALE,
  DIVERSE, PAIR, FAMILY, GROUP } }. Bei PAIR/FAMILY/GROUP ist der Wert pro
  Key KOMMAGETRENNT (mehrere Personen-Seeds), bei den anderen ein einzelner
  Seed-String. Siehe src/lib/avatarSettings.ts für Parsing/Defaults.

BEKANNTE FALLSTRICKE (Ergänzung)

@dicebear/styles und @dicebear/core können unterschiedliche "latest"-Versionen
  haben (Monorepo, aber nicht im Lockstep released) — vor jedem Versions-
  Bump beide separat gegen npm-Registry prüfen, sonst pnpm install (ETARGET).
DiceBear-SVGs NIEMALS mehrfach im selben Dokument verschachteln ohne
  idRandomization:true — interne <defs>-IDs (Kleidung, Frisur, Accessoires)
  sind sonst über mehrere Avatare hinweg identisch und überschreiben sich.
ESM-JSON-Imports mit "with { type: 'json' }" funktionieren in Node 22 pur,
  aber Kompatibilität mit Next.js/Webpack-Bundling ist nicht garantiert —
  für serverseitigen JSON-Zugriff auf node_modules-Pakete lieber
  fs.readFileSync(path.join(process.cwd(), 'node_modules', ...)) verwenden,
  Modul-System-unabhängig und getestet stabil.

--------------------------------------------------------------------

KDS – Session-Log Teil 10 (1.7.2026)
Letzter Commit: c91b889

STACK / INFRA (unverändert, siehe Teil 9)

DIESE SESSION – FERTIG

Vollständige Finanz-Analyse + Bereinigung + Vereinheitlichung (auf Anfrage Herbert:
"Bitte führe eine vollständige technische Analyse der Finanzmigration durch")

1) Analyse ergab: TheraPsy-Migration schrieb Honorarnoten in ZWEI parallele Modelle
   (Transaction UND FinanceTransaction), computeTransactionJournal() summierte beide
   ohne Abgleich → Doppelzählung in BMD-Export + Steuerberater-PDF.
2) scripts/finance-diagnose.ts gebaut (rein lesend) → am echten Server verifiziert:
   42 doppelt erfasste Belegnummern, 3.177,80€ zu hohe Reports, Math.abs()-Bug bei
   Stornos bestätigt (E26023/E26025 von -110€ zu +110€ verfälscht), E26043-Kollision
   (Privateinlage vs. echte Rechnung, zufällig gleiche Belegnummer) gefunden.
3) Root-Cause-Fixes: Bug A (Konto-2xxx fälschlich als Einnahme klassifiziert,
   therapsyParser.ts), Bug B (Math.abs() vernichtete Storno-Vorzeichen,
   therapsyExecutor.ts), Cross-Dedup zwischen Schritt 3/4 ergänzt.
4) scripts/finance-cleanup.ts gebaut + ausgeführt: 45 Duplikate gelöscht, E26043
   umbenannt zu "E26043-PRIVATEINLAGE". Diagnose danach: 0 Überschneidungen.
5) Herbert wollte "echte Vereinheitlichung" statt nur Bugfix → komplette
   Konsolidierung von FinanceTransaction (Legacy) auf Transaction (neues Modell)
   durchgeführt:
   - Transaction bekam neues Feld `category` (additiv, via normalem
     `prisma db push` in update.sh übernommen — keine manuelle Migration nötig)
   - therapsyExecutor.ts Schritt 4 (BMD-Import) schreibt jetzt Transaction+
     TxLineItem statt FinanceTransaction — kein Cross-Table-Dedup mehr nötig,
     referenceNumber-@unique reicht allein
   - transactionJournal.ts + profitStatement.ts: legacyTxs-Merge komplett entfernt,
     Transaction ist einzige Quelle
   - FinanceClient.tsx: Einnahmen UND Ausgaben laufen jetzt beide über
     /api/transactions (+ /api/transactions/manual), Hard-Delete bei Ausgaben durch
     Storno ersetzt (cancelTransaction(), war vorher schon direction-agnostisch,
     keine Änderung dort nötig)
   - Tote Routen /api/finance/transactions + /api/finance/transactions/[id] gelöscht
   - scripts/legacy-financetransaction-migrate.ts gebaut: übernimmt die
     verbleibenden FinanceTransaction-Zeilen (16 Ausgaben + Reste) nach Transaction.
     FinanceTransaction-Tabelle bleibt danach als Sicherheitsnetz bestehen (nicht
     gelöscht), wird aber von keinem Code-Pfad mehr aktiv beschrieben oder gelesen.

WICHTIG — Deploy-Reihenfolge bei Herbert (noch nicht bestätigt, dass er das schon
ausgeführt hat):
  1. sudo bash /opt/kds/update.sh   (zieht Code + fügt category-Spalte per db push hinzu)
  2. npx tsx scripts/legacy-financetransaction-migrate.ts --yes  (verbleibende
     Legacy-Zeilen übernehmen — WICHTIG: erst danach sind BMD-Export/Gewinnermittlung
     wieder vollständig, weil sie ab sofort NUR NOCH Transaction lesen)
  3. npx tsx scripts/finance-diagnose.ts  (zur Kontrolle)

PENDING / OFFEN

- Deploy-Bestätigung von Herbert für die Vereinheitlichung (Schritt 1-3 oben) noch
  ausständig — Zahlen nach Migration nochmal mit ihm gegenprüfen.
- FinanceTransaction-Tabelle könnte langfristig (nach hinreichender Beobachtungszeit,
  z.B. ein paar Wochen ohne Probleme) per Prisma-Schema-Migration ganz entfernt
  werden. Bewusst NICHT in dieser Session gemacht (Sicherheitsnetz).
- Wie bisher: Audio-Feature-Fragen offen, SMTP-Verschlüsselung offen, Dashboard
  verschachtelte $queryRaw-Template-Literals (Aktivitäts-Chart liefert leere Daten,
  unkritisch, nicht gefixt).

WICHTIGE PRISMA-FELDER / SCHEMA-GOTCHAS (Ergänzung, Stand c91b889)

Transaction.category (NEU): String? — freier Kategorie-Code (z.B. "HONORAR",
  "MISC_BUSINESS", passend zu INCOME_CATS/EXPENSE_CATS in FinanceClient.tsx).
  Ersetzt FinanceTransaction.incomeCategory/expenseCategory funktional.
FinanceTransaction gilt ab sofort als eingefroren — kein Code-Pfad schreibt mehr
  hinein. Nur noch als historisches Sicherheitsnetz in der DB, nicht gelöscht.

--------------------------------------------------------------------

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


