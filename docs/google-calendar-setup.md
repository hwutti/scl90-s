# Google Calendar Integration — Einrichtungsanleitung

## Schritt 1: Google Cloud Projekt erstellen
1. https://console.cloud.google.com → Neues Projekt: `KDS-Klinisches-Dokumentationssystem`

## Schritt 2: Google Calendar API aktivieren
1. APIs & Dienste → Bibliothek → "Google Calendar API" → Aktivieren

## Schritt 3: OAuth 2.0 Zugangsdaten erstellen
1. APIs & Dienste → Zugangsdaten → "OAuth-Client-ID"
2. Einwilligungsbildschirm: Nutzertyp Extern, App-Name: KDS, Scope: calendar
3. Anwendungstyp: Webanwendung
4. Weiterleitungs-URIs:
   - https://DEINE-DOMAIN.at/api/google-calendar/callback
   - http://localhost:3000/api/google-calendar/callback
5. Client-ID und Client-Secret notieren

## Schritt 4: .env konfigurieren
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://deine-domain.at/api/google-calendar/callback
```
Dann: sudo systemctl restart kds

## Schritt 5: In KDS verbinden
Administration → Einstellungen → Google Calendar → "Mit Google verbinden"

## Sync-Verhalten
- KDS → Google: Termine mit anonymisiertem Patientennamen (Code-Name)
- Google → KDS: Termine als Blocker importiert
- Ganztags-Termine in Google blockieren Online-Buchungen

## Datenschutz
Standardmäßig wird nur der Code-Name übertragen (z.B. KL-001), nie der vollständige Name.
