KDS – Session-Log Teil 13 (2.7.2026, Fortsetzung)
Letzter Commit: 268c01d fix(security): cooperation-partners/[id] GET+PATCH+DELETE auf requireStaffSession umgestellt

DIESE SESSION – FERTIG

===== TEIL A: Bugfixes aus Teil 12 =====

1) SessionsBillingPanel.tsx: `loadData()` aufgerufen, aber Funktion heißt `load()`
   → Crash bei saveEditLineItems(). Fix: loadData() → load().
2) RichTextEditor.tsx: `import TextStyle from '@tiptap/extension-text-style'`
   ist ein Named Export, kein Default Export (Tiptap 3.x) → Build-Fehler.
   Fix: `import { TextStyle } from ...`
3) NEUER GOTCHA (wichtig): Next.js/React Server Components reichen Date-Felder
   beim Server→Client-Props-Transport als ECHTE Date-Objekte durch (nicht als
   String, anders als bei normalem JSON/fetch). `date.slice(0,10)` crasht dann
   mit "X.slice is not a function". Immer normalisieren:
   `function toDateInputValue(d) { if (typeof d==='string') return d;
   if (d instanceof Date) return d.toISOString(); return null }`
   Betraf AbrechnenClient.tsx UND KooperationspartnerRechnungClient.tsx
   (letzteres vorbeugend gefixt, war nur noch nicht getriggert).

===== TEIL B: Honorarnote-Erstellung komplett neu (Patient + Kooperationspartner) =====

Herbert wollte: Rechnung direkt "wie in Word/Excel" bearbeiten, keine Tabelle +
separate Vorschau als zwei getrennte UIs, aber am Ende DOCH wieder eine
separate Vorschau des fertigen Dokuments (Fußzeile/Signatur/QR-Code sieht man
im vereinfachten Editor nicht).

ENDGÜLTIGES MUSTER (patients/[id]/abrechnen/AbrechnenClient.tsx UND
kooperationspartner/[id]/rechnung/neu/KooperationspartnerRechnungClient.tsx):
- Sitzungs-Checkliste oben (an/abwählen)
- Darunter: "Papier"-Karte im echten Rechnungs-Look (Logo/Header aus Branding,
  RECHNUNG AN, Rechnungsnummer VORSCHAU, Tabelle) — JEDE Zelle direkt editierbar
  (borderloses Input, das erst bei Fokus/Hover als Feld erkennbar wird)
- Beschreibung je Position = RichTextEditor (compact)
- Menge/Einzelpreis = number-Inputs, Gesamt live berechnet
- serviceLabel (kleine graue Unterzeile im PDF, z.B. "Psychotherapeutische
  Behandlung 45") jetzt EBENFALLS editierbar/löschbar — war vorher nirgends
  im Editor, nur unveränderlich in der Vorschau sichtbar
- "+ Position hinzufügen": manuelle Zeile OHNE Sitzungsbezug (sessionId: null,
  keine TxSessionAllocation)
- Jede Position einzeln löschbar (X-Button), OHNE die ganze Sitzung zu
  entfernen — BUG gefixt: X auf der ersten Position hat vorher die komplette
  Sitzung inkl. aller ihrer Positionen entfernt und den Editor geschlossen.
  Fix: removedKeys-Set (Frontend) + removedLineKeys-Array (Backend), Sitzung
  wird nur automatisch abgewählt wenn WIRKLICH alle ihre Positionen entfernt
  wurden (sonst bleibt sie korrekt verbucht, auch wenn ihre einzige Position
  komplett umgeschrieben wurde)
- Freitext-Rich-Text-Bereich (customNoteHtml) unter den Positionen
- Separate Live-Vorschau darunter (debounced 500ms, iframe mit echtem
  gerendertem HTML via renderDraftInvoiceHtml) — zeigt das TATSÄCHLICHE
  fertige Dokument inkl. Fußzeile/Signatur/SEPA-QR-Code/Vorlage

VERRECHNUNG-KONSISTENZ (Herbert mehrfach betont: "muss immer korrekt sein"):
Summe wird IMMER aus quantity × unitPriceNet der tatsächlichen Positions-
Daten berechnet (nie aus Freitext). Der gleiche Wert fließt konsistent in
Transaction.amountNet/vatAmount/amountGross, TxLineItem.amountNet UND
TxSessionAllocation.allocatedAmountNet. Sitzungs-Abrechnungsstatus
(UNBILLED/BILLED_UNPAID/PAID) wird NIE anhand eines Betrags-Abgleichs
gesetzt, sondern rein danach ob eine aktive TxSessionAllocation existiert
(deriveSessionBillingStatus in session.service.ts) — daher unproblematisch,
wenn Beträge nachträglich geändert werden.

BACKEND-ÄNDERUNGEN (transaction.service.ts, createTransactionFromSessions):
- lineItemOverrides: Record<string, {description?, descriptionHtml?,
  quantity?, unitPriceNet?, lineDate?, serviceLabel?}> — Key "session:<id>"
  für Sitzungs-Grundposition, "service:<id>" für Zusatzleistungen
- manualLines: [] — Positionen ohne Sitzungsbezug (sessionId: null)
- removedLineKeys: [] — welche automatisch generierten Positionen der Nutzer
  explizit gelöscht hat
- customNoteHtml
- Validierung: wenn nach Abzug removedLineKeys resolvedLines.length===0 →
  Error "Mindestens eine Rechnungsposition erforderlich"
- Alle drei (patients/abrechnen/preview/route.ts, transaction.service.ts,
  KooperationspartnerRechnungClient.tsx eigene Logik) nutzen denselben
  Override-Mechanismus, damit Vorschau/Erstellen garantiert übereinstimmen

TEMPLATE.TS ERWEITERT:
- {{custom_note_html}} Platzhalter ENDLICH ergänzt (war seit Teil 12 offener
  Punkt) — wird wie descriptionHtml unescaped gerendert (Rich-Text HTML)
- renderDraftInvoiceHtml nimmt jetzt customNoteHtml + descriptionHtml pro Line
  entgegen, für akkurate Live-Vorschau

BESTEHENDE (bereits ausgestellte) RECHNUNGEN BEARBEITEN — konsistent
angeglichen (KooperationspartnerDetailClient.tsx UND SessionsBillingPanel.tsx):
- Gleicher Rechnungs-Look (Logo, RECHNUNG AN, Tabelle) wie bei der Erstellung
- ABER: Menge/Einzelpreis/Gesamt sind hier READ-ONLY (nicht editierbar) —
  bewusst so, da einmal ausgestellte Rechnungsbeträge unveränderlich bleiben
  müssen (Compliance). Nur Beschreibungstext (RichTextEditor) + Freitext
  bleiben editierbar. PATCH /api/transactions/[id]/line-items unterstützt
  ohnehin nur descriptionHtml + customNoteHtml, keine Beträge.
- Branding wird bei SessionsBillingPanel.tsx CLIENT-SEITIG per fetch von
  /api/admin/branding geholt (nicht über Props durchgereicht), um die große
  PatientRecordClient.tsx (1382 Zeilen) nicht anfassen zu müssen

===== TEIL C: Honorarnote-Entwürfe (neues Feature) =====

Herbert wollte: Rechnung anfangen, speichern OHNE sie verbindlich zu
erstellen, später weiterbearbeiten.

NEUES PRISMA-MODELL: InvoiceDraft
- patientId, createdByUserId, sessionIds (Json), lineItemOverrides (Json),
  manualLines (Json), removedLineKeys (Json), customNoteHtml,
  payerName/payerAddress/vatRate/paymentMethod/markAsPaid/generateInvoiceDoc/
  anonymizeInvoice/invoiceTemplateId/notes, createdAt/updatedAt
- Relation auf Patient (invoiceDrafts) und User (createdBy, @relation
  "UserInvoiceDrafts")

NEUE ROUTEN:
- GET/POST /api/patients/[id]/abrechnen/draft — Entwürfe auflisten / neuen
  anlegen
- GET/PATCH/DELETE /api/invoice-drafts/[id] — einzelnen Entwurf laden/
  aktualisieren/löschen

FRONTEND (nur Patienten-Flow, NICHT Kooperationspartner):
- "Entwurf speichern"-Button neben "Honorarnote erstellen"
- ?draftId=... Query-Param lädt Entwurf beim Seitenaufruf (page.tsx server-
  seitig), initialisiert kompletten State daraus
- Banner "Du hast einen gespeicherten Entwurf" wenn welche existieren und
  nicht gerade einer geladen ist (Weiterbearbeiten / Verwerfen)
- Nach erfolgreichem "Honorarnote erstellen": zugehöriger Entwurf wird
  automatisch gelöscht (ist jetzt eine echte Rechnung geworden)
- buildPayloadBase() als gemeinsame Funktion für Vorschau/Erstellen/
  Entwurf-Speichern — garantiert identische Daten in allen drei Fällen

===== TEIL D: Access-Control / Security-Fixes (Codex-Analyse geprüft + umgesetzt) =====

Herbert hat eine externe Codex-Analyse mit 7 TODOs geliefert. ERST NUR
GEPRÜFT (nichts geändert), dann nach Bestätigung alle 7 umgesetzt.

WICHTIG: Die Analyse ging davon aus, dass Helper `requireStaffSession`,
`requireAdminSession`, `buildAccessibleTransactionWhere`,
`canAccessCooperationPartner` bereits existieren — TATEN SIE NICHT. Mussten
neu gebaut werden in src/lib/access.ts (ergänzt canAccessPatient/
getAccessiblePatientIds, die schon da waren).

ZWEI ANALYSE-PRÄMISSEN WAREN NACHWEISLICH FALSCH (beim Prüfen gefunden):
- TODO3: Analyse sagte "patientId wird geprüft, cooperationPartnerId nicht"
  → Tatsächlich wurde WEDER patientId NOCH cooperationPartnerId geprüft im
  POST /api/transactions/route.ts, Body wurde 1:1 durchgereicht.
- TODO6/7: Analyse sagte "Bearbeiten/Löschen ist admin-only" (bei
  invoice-templates UND cooperation-partners) → Stimmte nicht, PATCH/DELETE
  hatten in BEIDEN Fällen überhaupt keine Rollenprüfung, nur "eingeloggt".

UMGESETZT (alle 7 TODOs, Details im Chat-Verlauf):
1. 5 globale Settings-Routen (general/visual/anamnesis-template/
   session-templates/[id]) → requireStaffSession (vorher: jede eingeloggte
   Session inkl. Patienten-Login konnte globale Praxisdaten ändern)
2. settings/visual/route.ts: unerlaubtes Mirroring von accentColor nach
   PraxisConfig.colorPrimary (globales Branding) komplett entfernt — globales
   Branding läuft ausschließlich über /api/admin/branding (schon admin-only)
3. transactions/route.ts: GET+POST auf requireStaffSession +
   buildAccessibleTransactionWhere, POST validiert patientId (canAccessPatient)
   und cooperationPartnerId (canAccessCooperationPartner) serverseitig
4. dunningSuggestions.ts: createdByUserId-Filter → buildAccessibleTransactionWhere
5. dashboard/route.ts: totalTransactions/unpaidAmount/txActivity →
   buildAccessibleTransactionWhere (Session-/Termin-Queries bewusst
   unangetastet gelassen)
6. invoice-templates/route.ts + [id]/route.ts: GET=Staff, POST/PATCH/DELETE=
   Admin (waren komplett offen!). admin/settings/page.tsx: volle
   Template-Datensätze (HTML/Signatur/IBAN) nur noch für ADMIN geladen,
   THERAPIST bekommt nur {id, name, isDefault}
7. cooperation-partners/route.ts + [id]/route.ts: alle 4 Methoden (GET/POST/
   PATCH/DELETE) → requireStaffSession. PRODUKTENTSCHEIDUNG: da Bearbeiten/
   Löschen nie tatsächlich admin-only war (Analyse-Annahme falsch), hätte
   striktes Admin-only jetzt Funktionalität weggenommen — stattdessen
   konsistent staff-weit (ADMIN+THERAPIST gleichberechtigt) statt patienten-
   zugänglich gemacht. Falls strengeres Admin-only gewünscht: noch offen.

buildAccessibleTransactionWhere-LOGIK (src/lib/access.ts):
- ADMIN in Einzelpraxis ODER mit seeFinance-Recht → {} (alles)
- Sonst: OR von [patientId in getAccessiblePatientIds(), cooperationPartnerId
  not null (Partner-Transaktionen sind staff-weit sichtbar, kein Freigabe-
  Konzept wie bei Patienten — bewusste Annahme), createdByUserId = eigene]

===== GOTCHAS / SCRIPTING-LERNEN DIESE SESSION =====

- GitHub Contents-API PUT: `sha`-Parameter muss die SHA aus einem vorherigen
  GET/contents-Aufruf sein (Blob-SHA), NICHT die `commit.sha` aus der Antwort
  eines vorherigen PUT-Aufrufs — sonst 409 "does not match". Vor jedem PUT
  neu per GET die aktuelle Content-SHA holen, wenn zwischenzeitlich commitet
  wurde.
- React.CSSProperties/React.FocusEvent etc. brauchen expliziten Type-Import
  (`import { type CSSProperties, type FocusEvent } from 'react'`) wenn nur
  `{ useState }` importiert ist — sonst "Cannot find namespace 'React'".

OFFENE PUNKTE / BEKANNTE EINSCHRÄNKUNGEN

- SMTP-Verschlüsselung offen (bekannt, seit mehreren Sessions)
- TheraPsy Kurzprotokoll/Langprotokoll: canImport:false (Spalten-Layout nicht
  verifiziert, braucht echten befüllten Export)
- FinanceTransaction-Tabelle noch nicht gelöscht (Sicherheitsnetz)
- Honorarnote-Entwürfe (InvoiceDraft) nur im Patienten-Flow, NICHT im
  Kooperationspartner-Flow gebaut — falls gewünscht, gleiches Muster
  übertragbar
- Access-Fixes nur mechanisch verifiziert (Datei-Review), nicht end-to-end
  am Server getestet — Herbert sollte nach Deploy kurz durchklicken,
  besonders TODO3 (Transaktion anlegen) und TODO7 (Kooperationspartner)
- TODO7-Entscheidung (staff-weit statt admin-only bei Kooperationspartner
  Bearbeiten/Löschen) ist eine Annahme, keine von Herbert bestätigte
  Entscheidung — bei Bedarf revidierbar

WICHTIGE REGELN (unverändert)
- Vor jedem Fix: Analyse zeigen, Herbert bestätigen lassen
- Ende jeder Session: CONTEXT.md updaten
- Alle Server-Änderungen idempotent in install.sh UND update.sh
- prisma generate schlägt in Sandbox fehl → Feldnamen manuell prüfen
- next build kompiliert sauber = ausreichend für Verifizierung
- GitHub-Token: wurde diese Session mehrfach im Klartext geteilt (Herbert
  bewusst) — sollte bei Gelegenheit rotiert werden, falls noch nicht erfolgt

────────────────────────────────────────────────────────────────────────────

KDS – Session-Log Teil 12 (2.7.2026)
Letzter Commit: 2e2696e feat(editor): Tiptap Rich-Text-Editor fuer Rechnungspositionen

STACK / INFRA
- Next.js 14 / Prisma / PostgreSQL / pnpm / systemd / nginx (Reverse-Proxy)
- Repo: hwutti/scl90-s, Deploy: /opt/kds, User: kds, Service: kds
- WICHTIG: `prisma generate` schlägt in der Dev-Sandbox fehl (Netzwerk blockiert
  binaries.prisma.sh) → Prisma-Typen nur als any-Stub. Feldnamen immer manuell
  gegen schema.prisma prüfen. Am Server: pnpm install && npx prisma generate &&
  npx prisma db push --accept-data-loss && pnpm build
- WICHTIG: pnpm-lock.yaml ist jetzt im Repo. Wenn update.sh mit
  "untracked pnpm-lock.yaml would be overwritten" abbricht:
  sudo rm /opt/kds/pnpm-lock.yaml && sudo bash update.sh
- NEU: @tiptap/* (9 Extensions, MIT-Lizenz) als Dependencies

NEUE ABHÄNGIGKEITEN (diese Session)
- @tiptap/react, @tiptap/pm, @tiptap/starter-kit
- @tiptap/extension-color, @tiptap/extension-text-style
- @tiptap/extension-font-family, @tiptap/extension-underline
- @tiptap/extension-text-align, @tiptap/extension-highlight
- @tiptap/extension-placeholder

NEUE SCHEMA-FELDER (alle via prisma db push beim Deploy hinzugefügt)
- TxLineItem.descriptionHtml String? — Rich-Text HTML (Tiptap), hat Vorrang
  vor description in der Rechnungsdarstellung
- Transaction.customNoteHtml String? — Freitext-Bereich unter den Positionen
- PraxisConfig.loginLogoSize Int @default(64) — Logo-Größe Login-Seite
- PraxisConfig.loginBoxOffsetX Int @default(0) — Feinpositionierung X (%)
- PraxisConfig.loginBoxOffsetY Int @default(0) — Feinpositionierung Y (%)
- PraxisConfig.loginCardBg String @default("rgba(255,255,255,0.92)")
- PraxisConfig.loginCardBlur Int @default(12) — Glasmorphism blur px
- PraxisConfig.loginCardRadius Int @default(20) — Border-radius px
- PraxisConfig.loginCardShadow Boolean @default(true)
- PraxisConfig.appFontFamily String @default("system")
- PraxisConfig.appFontSize Int @default(14)
- PraxisConfig.loginBgImageBase64 String? — Login-Hintergrundbild
- PraxisConfig.loginBgImageMime String?
- PraxisConfig.loginBgColor String? — Fallback-Hintergrundfarbe
- PraxisConfig.loginBoxPosition String @default("center")
- PraxisConfig.loginBgOverlay Float @default(0.0)
- CooperationPartner (neues Modell, komplett diese Session)
- CooperationPartnerInvoiceTemplate (neues Modell)
- Patient.cooperationPartnerId String? (FK zu CooperationPartner)
- Transaction.cooperationPartnerId String? (FK zu CooperationPartner)

DIESE SESSION – FERTIG

===== TEIL A: TheraPsy-Migration Bugfixes =====

1) therapsyParser.ts: Kurzprotokoll/Langprotokoll waren hardcoded als
   status:'empty'/canImport:false — Preview behauptete pauschal "nicht im
   Export", egal was wirklich drin stand.
   Fix: readAllSheets() neu (liest alle Sheets), parseSessionsXlsx liest
   Zusatzspalten ab Index 10, Preview zeigt ehrlich was gefunden wurde.
   Import bleibt canImport:false — Spalten-Layout noch nicht verifiziert.

===== TEIL B: Illustrierte Avatare =====

2) Zweiter Avatar-Stil "Illustriert" (echte Zeichnungen, keine DiceBear-Generierung):
   - 65 Bilder aus User-Upload extrahiert (Python/PIL, 5×13 Grid):
     39 Einzelportraits → public/avatars/illustrated/individuals/ind01-39.png
     13 Kinder → public/avatars/illustrated/kids/kid01-13.png
     13 Gruppen/Paar/Familie → public/avatars/illustrated/groups/grp01-13.png
   - Neuer Stil-Umschalter in Einstellungen → Avatare (Dicebear ↔ Illustriert)
   - Neue Gruppe CHILD (Kind): nutzt bestehende isKind-Logik (age < 18)
   - Paar/Familie/Gruppe: feste fertige Bilder statt per-Person-Kombinierung
   - BUG (gefixt sofort): DEFAULT_AVATAR_SEEDS in PatientsListClient.tsx hatte
     keinen CHILD-Eintrag → TypeError 'can't access property includes, e is
     undefined' bei allen Patienten < 18 → /patients Crash
   - avatarImgSrc() defensiv gemacht (Fallback-String statt Crash)
   - Dicebear-Funktionen aus avatarSettings.ts ausgelagert nach avatarDicebear.ts
     (Client-Komponenten dürfen kein fs/path importieren → Build-Fehler)

===== TEIL C: Zusatzleistungen in Rechnungen =====

3) BUG: Beim Erstellen einer Rechnung aus Sitzungen wurden SessionServiceLine-
   Einträge ("Zusatzleistung hinzufügen") komplett ignoriert:
   - createTransactionFromSessions: lädt jetzt SessionServiceLine je Sitzung,
     erzeugt pro Zusatzleistung eigene TxLineItem + TxSessionAllocation
   - abrechnen/preview/route.ts: gleicher Fix für Live-Vorschau
   - abrechnen/page.tsx + AbrechnenClient.tsx: Zusatzleistungs-Summe wird
     jetzt mitgeladen und in der Sitzungsauswahl angezeigt

===== TEIL D: Kooperationspartner-Feature =====

4) Neuer Menüpunkt "Kooperationspartner" (Sidebar: Handshake-Icon):
   KONZEPT: Herbert behandelt Patienten für externe Partner (Institutionen),
   rechnet aber gesammelt an den Partner statt direkt am Patienten ab.
   Patienten unter einem Partner sind vom normalen Patientenstamm entkoppelt.

   PHASE 1 – Grundgerüst:
   - /kooperationspartner: Liste + Anlegen-Modal (Name, Adresse, UID, USt., etc.)
   - /kooperationspartner/[id]: Stammdaten (editierbar) + Patientenliste
     (WIEDERVERWENDUNG von PatientsListClient.tsx via cooperationPartnerId-Prop)
   - /admin/kooperationspartner-rechnungsvorlage: eigene Vorlagen getrennt vom
     Patienten-Pool (gleiche UI wie RechnungsvorlageClient.tsx, nur anderer Endpoint)
   - /patients und /api/patients GET filtern jetzt: cooperationPartnerId IS NULL
   - BUG (sofort gefixt): leerer String '' als defaultInvoiceTemplateId → FK-Verletzung
     Fix: '' wird zu null normalisiert in POST + PATCH

   PHASE 2 – Flexible Rechnungserstellung:
   - /kooperationspartner/[id]/rechnung/neu: freie Rechnungserstellung
     BEIDE Wege kombiniert: Sitzungen über ALLE Patienten des Partners auswählen
     (vorbefüllt) UND freie Positionen ohne Sitzungsbezug hinzufügen
   - Alle Positionen direkt editierbar in der Tabelle
   - Live-Vorschau (debounced 500ms) + E-Mail-Versand nach Erstellen
   - createPartnerTransaction() in transaction.service.ts (neu, getrennt von
     createTransactionFromSessions um Patienten-Flow nicht zu riskieren)
   - template.ts: getDefaultTemplate/renderDraftInvoiceHtml/renderInvoiceHtmlForTransaction
     um usePartnerTemplates-Flag erweitert (automatisch erkannt via cooperationPartnerId)
   - Rechnungsliste auf Partner-Detailseite: Bezahlt markieren, Stornieren,
     Drucken/PDF — via bestehende Endpoints (waren schon patientId-optional)
   - /api/transactions GET: cooperationPartnerId als Filterparameter ergänzt
   - cancelTransaction: cooperationPartnerId wird auf Storno-Transaktion kopiert
   - BUG (sofort gefixt): Plus-Button für freie Positionen war disabled bei
     leerer Beschreibung → nach Hinzufügen immer geleert → Block
   - Datum-Feld bei freien Positionen ergänzt (Standard: heute)

===== TEIL E: Login-Seite Design & Typografie =====

5) Login-Seite komplett überarbeitet (src/app/(auth)/login/LoginClient.tsx):
   - Gradientiger Anmelden-Button, Focus-Ringe auf Inputs, verfeinerter Tab-Switcher
   - Glasmorphism (backdrop-filter blur) korrekt mit -webkit-Prefix
   - Logo ohne harten Rahmen, drop-shadow bei Hintergrundbild
   - Hintergrundbild, Overlay, Box-Position, Logo-Größe, Card-Design aus BrandingConfig
   - Feinpositionierung via loginBoxOffsetX/Y (transform: translate)
   - Bei Hintergrundbild: text-shadow auf Praxisname/Slogan für Lesbarkeit
   
   Neue Einstellungen in Branding → Login-Seite Design:
   - Hintergrundbild Upload (max 8 MB)
   - Fallback-Hintergrundfarbe (Color Picker)
   - Overlay-Slider (0-70% Abdunkelung)
   - 3×3 Raster-Picker für Grobposition + X/Y Slider für Feinposition
   - Logo-Größe Slider (32-120px)
   - Card-Hintergrund: visueller Farbwähler + Transparenz-Slider (kein RGBA-Text)
   - Glasmorphism Blur Slider (0-24px)
   - Eck-Radius Slider (0-32px)
   - Schatten-Checkbox
   - LIVE-VORSCHAU (260×380px) aktualisiert sich bei jeder Änderung ohne Speichern

6) Globale App-Typografie:
   - appFontFamily: 6 System-Fonts (system/inter/georgia/palatino/optima/gill-sans)
   - appFontSize: Slider 13-18px (Standard 14)
   - Live-Preview: CSS-Vars werden direkt auf documentElement gesetzt
   - body nutzt --font-family und --font-size-base aus brandingToCssVars()
   - Root-Layout injiziert CSS-Vars via <style>

7) Branding-API (src/app/api/admin/branding/route.ts): alle neuen Felder ergänzt

===== TEIL F: signOut / NEXTAUTH_URL Fix =====

8) Problem: Logout leitete auf localhost:3000 weiter (nicht externe Domain)
   Root Cause: App läuft hinter nginx Proxy Manager (server_name _), SSL
   terminiert vor dem Server → keine Domain erkennbar
   Fix: signOut({ callbackUrl: window.location.origin + '/login' }) in Sidebar.tsx
   NEXTAUTH_URL = http://localhost:3000 ist korrekt für Reverse-Proxy-Betrieb
   update.sh: setzt NEXTAUTH_URL jetzt fest auf http://localhost:APP_PORT
   (alle bisherigen Erkennungsversuche via nginx/Let's Encrypt entfernt)
   install.sh: Domain-Abfrage entfernt, APP_URL fest auf localhost

===== TEIL G: Tiptap Rich-Text-Editor =====

9) Globale RichTextEditor-Komponente (src/components/editor/RichTextEditor.tsx):
   - Tiptap (MIT, gratis, kein API-Key) mit allen Extensions
   - Toolbar: Fett/Kursiv/Unterstrichen/Durchgestrichen, Textfarbe (Color Picker),
     Hervorheben, Schriftart (Arial/Georgia/Palatino/Times/Courier), Ausrichtung,
     Listen, Undo/Redo
   - compact-Prop für Tabellenverwendung (schmalere Toolbar)
   - SSR-sicher via next/dynamic
   
   Rechnungserstellung (Kooperationspartner):
   - Jede Positionsbeschreibung = Rich-Text-Editor (compact)
   - Neuer Freitext-Bereich unter den Positionen
   
   Bestehende Rechnungen (noch nicht bezahlt):
   - Stift-Button öffnet Edit-Panel inline
   - Alle Positionsbeschreibungen editierbar + Freitext
   - PATCH /api/transactions/[id]/line-items (neue Route)
   - Nur UNPAID/ACTIVE Transaktionen editierbar (Server-Validierung)
   
   Gilt für: Patienten-Rechnungen (SessionsBillingPanel.tsx) UND
   Kooperationspartner-Rechnungen (KooperationspartnerDetailClient.tsx)
   
   Rechnungsvorlage (template.ts): {{this.description}} rendert descriptionHtml
   wenn gesetzt (hat Vorrang vor Plaintext-Fallback)

OFFENE PUNKTE / BEKANNTE EINSCHRÄNKUNGEN

- FinanceTransaction-Tabelle noch nicht gelöscht (Sicherheitsnetz, seit Teil 11)
- SMTP-Verschlüsselung offen (bekannt)
- Dashboard-Aktivitäts-Chart mit leeren Daten (unkritisch)
- TheraPsy Kurzprotokoll/Langprotokoll: canImport:false (Spalten-Layout nicht
  verifiziert, braucht echten befüllten Export)
- customNoteHtml erscheint noch NICHT im PDF (template.ts rendert es noch nicht,
  muss in den Vorlagen als {{custom_note_html}} Platzhalter ergänzt werden)
- PatientRecordClient.tsx zeigt bei Kooperationspartner-Patienten noch den
  normalen "Abrechnen"-Button — wurde bewusst nicht angefasst (zu großes Risiko)

WICHTIGE REGELN (unverändert)
- Vor jedem Fix: Analyse zeigen, Herbert bestätigen lassen
- Ende jeder Session: CONTEXT.md updaten
- Alle Server-Änderungen idempotent in install.sh UND update.sh
- prisma generate schlägt in Sandbox fehl → Feldnamen manuell prüfen
- next build kompiliert sauber = ausreichend für Verifizierung
