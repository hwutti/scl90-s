# SCL-90-S Webapp

Vollständige Webanwendung zur Durchführung und Auswertung des **Symptom-Checkliste-90-Standard (SCL-90-S)** Fragebogens nach Franke (2014).

Entwickelt für den klinischen Einsatz in Psychotherapie, Psychiatrie und Rehabilitation.

---

## Features

- **90-Item Fragebogen** mit 0–4 Bewertungsskala, Keyboard-Navigation und Auto-Save
- **Automatische Auswertung** aller 9 Skalen + 3 globale Kennwerte (GSI, PST, PSDI)
- **5-Schritte-Interpretation** nach Franke-Manual inkl. Falldefinition (T ≥ 63)
- **T-Score Berechnung** mit konfigurierbaren Normtabellen (mehrere Normpopulationen)
- **Ampelsystem** (grün/gelb/rot) nach klinischen Cutoffs
- **Balken- und Radardiagramm** der Skalenwerte
- **PDF-Bericht** mit vollständigem Auswertungsbogen
- **Verlaufsmessung** – Zeitreihen über mehrere Erhebungen
- **Rollenkonzept**: Admin / Therapeut / Patient (via PIN)
- **DSGVO-konform**: AES-256 Verschlüsselung, Audit-Log, Löschfunktion

---

## Schnellinstallation (One-Liner)

Auf einem frischen **Ubuntu 22.04 oder 24.04 LTS** Server als root:

```bash
curl -fsSL https://raw.githubusercontent.com/hwutti/scl90-s/main/install.sh | sudo bash
```

Das Skript fragt interaktiv nach:
- **Domain** (z.B. `scl90.meinserver.at`) – oder leer lassen für IP-only
- **pgAdmin E-Mail** (Admin-Login für die Datenbankverwaltung)
- **E-Mail für Let's Encrypt** (nur bei Angabe einer Domain)

Alle Passwörter werden automatisch generiert und am Ende angezeigt.

> **Hinweis:** Das Skript benötigt Root-Rechte und eine frische Ubuntu-Installation. Auf bestehenden Servern bitte zuerst das Skript prüfen.

---

## Was das Installationsskript einrichtet

| Komponente | Version | Beschreibung |
|---|---|---|
| **Node.js** | 20 LTS | JavaScript-Runtime (via NodeSource) |
| **pnpm** | latest | Paketmanager (schneller als npm) |
| **Next.js** | 14 | Full-Stack React Framework |
| **PostgreSQL** | 16 | Datenbank (offizielles pgdg-Repo) |
| **Prisma** | latest | ORM + Datenbankmigrationen |
| **pgAdmin 4** | latest | Web-UI für Datenbankmanagement |
| **Nginx** | latest | Reverse Proxy mit Rate-Limiting & Security Headers |
| **Certbot** | latest | SSL/TLS via Let's Encrypt (auto-renewal) |
| **Fail2ban** | latest | Brute-Force-Schutz |
| **UFW** | latest | Firewall (SSH + HTTP/S erlaubt) |

**Automatisch konfiguriert:**
- PostgreSQL Datenbank + User mit zufälligem Passwort
- Prisma-Datenbankschema (Users, Sessions, Answers, Results, NormTables, AuditLog)
- systemd-Service (startet automatisch nach Reboot)
- Nginx als Reverse Proxy mit Security-Headers und Rate-Limiting
- SSL-Zertifikat (wenn Domain angegeben) mit automatischer Erneuerung
- Tägliches Datenbank-Backup um 02:30 Uhr (30 Tage Aufbewahrung)
- Fail2ban gegen Brute-Force-Angriffe
- UFW Firewall (Port 22, 80, 443 offen – PostgreSQL und Node.js nur intern)

---

## Systemanforderungen

| Anforderung | Minimum | Empfohlen |
|---|---|---|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **RAM** | 1 GB | 2 GB |
| **CPU** | 1 vCore | 2 vCores |
| **Disk** | 10 GB | 20 GB |
| **Domain** | optional | empfohlen (für SSL) |

---

## Datenbankschema

```
User ─────────────────── AssessmentSession ─── Answer (×90)
  │  (Therapeut/Patient)       │                    │
  │                            │                 (item 1–90,
  │                     AssessmentResult            Wert 0–4)
  │                       (GSI, PST, PSDI,
  │                        T-Scores, JSON)
  │
  └── AuditLog  (DSGVO Art. 30 – alle Zugriffe)
  └── NormTable (Normwerte nach Franke 2014)
```

### Tabellen im Überblick

| Tabelle | Beschreibung |
|---|---|
| `User` | Therapeuten, Patienten (PIN-Login), Admins |
| `AssessmentSession` | Eine Fragebogen-Erhebung (IN_PROGRESS → SCORED) |
| `Answer` | Einzelne Item-Antworten (90 pro Session) |
| `AssessmentResult` | Berechnete Skalen- und Globalwerte als JSON |
| `NormTable` | Normwerte (Franke 2014) – Hogrefe-Lizenz erforderlich |
| `AuditLog` | Vollständiges Zugriffsprotokoll (DSGVO Art. 30) |

---

## Auswertungslogik

Die Auswertung folgt dem 5-Schritte-Interpretationsschema nach Franke (2014):

### Schritt 1 – Falldefinition
Klinisch auffällig belastet, wenn:
- **T(GSI) ≥ 63** _oder_
- **≥ 2 Skalen mit T ≥ 63**

### Schritt 2 – Globale Kennwerte

| Kennwert | Berechnung | Bedeutung |
|---|---|---|
| **GS** | Summe aller Itemrohwerte | Gesamtbelastung absolut |
| **GSI** | GS / (90 − Missing) | Allgemeine psychische Belastung |
| **PST** | Anzahl Items mit Wert > 0 | Anzahl belasteter Symptombereiche |
| **PSDI** | GS / PST | Intensität der Belastung |

**T-Wert Faustregel:**
- T 60–64: leicht erhöht
- T 65–69: deutlich erhöht
- T 70–74: stark erhöht
- T 75–80: sehr stark erhöht

### Schritt 3 – Skalenausprägung (T ≥ 60 = auffällig)

| Skala | ID | Items | Cronbachs α |
|---|---|---|---|
| Somatisierung | S1 | 1,4,12,27,40,42,48,49,52,53,56,58 | gut |
| Zwanghaftigkeit | S2 | 3,9,10,28,38,45,46,51,55,65 | sehr gut |
| Unsicherheit im Sozialkontakt | S3 | 6,21,34,36,37,41,61,69,73 | gut |
| Depressivität | S4 | 5,14,15,20,22,26,29,30,31,32,54,71,79 | sehr gut |
| Ängstlichkeit | S5 | 2,17,23,33,39,57,72,78,80,86 | sehr gut |
| Aggressivität/Feindseligkeit | S6 | 11,24,63,67,74,81 | befriedigend |
| Phobische Angst | S7 | 13,25,47,50,70,75,82 | gut |
| Paranoides Denken | S8 | 8,18,43,68,76,83 | gut |
| Psychotizismus | S9 | 7,16,35,62,77,84,85,87,88,90 | gut |
| Zusatzitems | S10 | 19,44,59,60,64,66,89 | — |

### Schritt 4 – Item-Analyse
Bei Skalen mit T ≥ 60: Einzelne Items mit Wert ≥ 2 werden hervorgehoben.

### Schritt 5 – Zusatzitems
Auffällig wenn Wert ≥ Mittelwert + 1 Standardabweichung der Normstichprobe.

### Ampelsystem (Skalenwert G = Mittelwert der Skala)
- 🟢 **Grün**: G < 0.50
- 🟡 **Gelb**: G 0.50 – 1.49
- 🔴 **Rot**: G ≥ 1.50

---

## Normtabellen

> ⚠️ **Wichtig:** Die offiziellen Normwerte aus dem Franke-Manual (2014) sind urheberrechtlich geschützt (Hogrefe-Verlag) und müssen separat lizenziert werden. Das System unterstützt den Import eigener Normtabellen als JSON.

**Verfügbare Normpopulationen:**
- Allgemeinbevölkerung (Franke 2014, N=2.025, Erhebung 2011–2012, Alter 16–75 Jahre)
- Studierende (N=1.016)
- Stationäre Psychotherapiepatienten (N=1.263)
- Orthopädische Rehabilitationspatienten (N=237)

**JSON-Format für den Import:**
```json
{
  "default": {
    "scales": {
      "S1": { "mean": 0.00, "sd": 0.00 },
      "S2": { "mean": 0.00, "sd": 0.00 }
    },
    "gsi":  { "mean": 0.00, "sd": 0.00 },
    "pst":  { "mean": 0,    "sd": 0    },
    "psdi": { "mean": 0.00, "sd": 0.00 }
  },
  "männlich": { "scales": { ... } },
  "weiblich":  { "scales": { ... } }
}
```

---

## Nach der Installation

### Zugangsdaten finden
```bash
cat /root/scl90s_credentials.txt
```

### Nützliche Befehle

```bash
# Service-Status
systemctl status scl90s

# Live-Logs
journalctl -u scl90s -f

# Nginx-Fehlerlog
tail -f /var/log/nginx/scl90s_error.log

# Manuelles Datenbank-Backup
sudo -u postgres /usr/local/bin/scl90s-backup.sh

# Datenbank-Konsole
sudo -u postgres psql scl90s_db

# App neu starten
systemctl restart scl90s

# Update deployen
cd /opt/scl90s && git pull && pnpm install && pnpm build && systemctl restart scl90s
```

### Verzeichnisstruktur

```
/opt/scl90s/               # App-Verzeichnis
├── src/
│   ├── app/               # Next.js App Router (Seiten)
│   │   ├── api/           # API Routes
│   │   ├── session/       # Fragebogen
│   │   ├── results/       # Auswertung
│   │   └── dashboard/     # Verlaufsübersicht
│   └── lib/
│       ├── scoring.ts     # Auswertungslogik (Skalen, GSI, T-Scores)
│       ├── prisma.ts      # Datenbank-Client
│       └── crypto.ts      # AES-256 Verschlüsselung
├── prisma/
│   └── schema.prisma      # Datenbankschema
└── .env                   # Zugangsdaten (chmod 600)

/var/backups/scl90s/       # Automatische DB-Backups
/var/log/nginx/            # Nginx-Logs
```

---

## DSGVO-Hinweise

Diese Anwendung verarbeitet **besondere Kategorien personenbezogener Daten** (Art. 9 DSGVO – Gesundheitsdaten).

**Implementierte Maßnahmen:**
- AES-256 Verschlüsselung für Name und Geburtsdatum auf Anwendungsebene
- Pseudonymisierung durch interne IDs
- Vollständiges Audit-Log aller Zugriffe (Art. 30 DSGVO)
- Löschfunktion auf Anfrage (Art. 17 DSGVO)
- Keine Datenübertragung an Dritte
- Server-Hosting in der EU (eigener Server)
- Firewall: PostgreSQL und Node.js nicht direkt aus dem Internet erreichbar

**Vor Produktiveinsatz zwingend erforderlich:**
- [ ] Datenschutz-Folgenabschätzung (DSFA) durchführen
- [ ] Verarbeitungsverzeichnis anlegen
- [ ] Auftragsverarbeitungsvertrag (falls Hosting durch Dritte)
- [ ] Datenschutzerklärung für Patienten erstellen
- [ ] ENCRYPTION_KEY in `.env` auf starken, selbst generierten Wert setzen

---

## Disclaimer

> Die SCL-90-S ist **kein Diagnoseinstrument**. Sie dient der Verlaufs- und Erfolgskontrolle sowie dem Screening – nicht der Diagnosestellung. Eine Pathologisierung von Befragten auf Basis der Ergebnisse ist ausdrücklich zu vermeiden (Franke, 2014).

---

## Lizenz & Referenzen

- Franke, G. H. (2014). *SCL-90®-S. Symptom-Checklist-90®-Standard – Manual*. Göttingen: Hogrefe Verlag.
- Derogatis, L. R. (1977). *SCL-90-R: Administration, scoring and procedures manual*. Baltimore: Clinical Psychometric Research.
- Hessel, A. et al. (2001). Symptom-Checkliste SCL-90-R: Testtheoretische Überprüfung und Normierung an einer bevölkerungsrepräsentativen Stichprobe. *Diagnostica*, 47(1), 27–39.

Der Code dieser Webapp steht unter der **MIT-Lizenz**. Die SCL-90-S Testinhalte (Items, Normtabellen) sind urheberrechtlich geschützt (© Hogrefe Verlag) und nicht in diesem Repository enthalten.

---

## T-Normen (Franke 2014) – Digitalisiert

Das System enthält die vollständig digitalisierten alters- und geschlechtsspezifischen T-Norm-Lookup-Tabellen aus:

> Franke, G. H. (2014). *SCL-90®-S. Symptom-Checklist-90®-Standard – Manual*. Göttingen: Hogrefe Verlag.

### Anhang B – Männer (N = 136–217 je Altersgruppe)
Alle 9 Hauptskalen (AGG, ANG, DEP, PAR, PHO, PSY, SOM, UNS, ZWA) + GSI + PST

### Anhang C – Frauen (N = 130–210 je Altersgruppe)
Alle 9 Hauptskalen + GSI

**Altersgruppen:** 16–24 · 25–34 · 35–44 · 45–54 · 55–64 · 65–74 Jahre

**Methode:** Direkter Summe→T Lookup (Skalen), lineare Interpolation (GSI)

Das System wählt automatisch die passende Normtabelle anhand von **Geschlecht** und **Geburtsdatum** des Patienten.
