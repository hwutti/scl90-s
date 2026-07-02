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
