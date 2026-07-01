import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface TpPatient {
  profilNr: number
  codeName: string
  firstName: string
  lastName: string
  fullName: string
  street: string | null
  city: string | null
  diagnoses: string[]
  method: string | null
  unitPriceNet: number | null
  unitDurationMinutes: number | null
}

export interface TpSession {
  profilNr: number
  codeName: string
  sessionName: string
  sessionNumber: number
  date: string
  durationMinutes: number
  serviceLabel: string
  diagnoses: string[]
  supervisionName: string | null
  supervisorName: string | null
  supervisionDate: string | null
}

export interface TpInvoice {
  invoiceNr: string
  type: 'INCOME' | 'EXPENSE'
  date: string
  paidDate: string | null
  /** Echter Zahlungsstatus aus Finanzexport-Gesamtübersicht (nicht aus der Einzel-Rechnung ableitbar).
   *  Fehlt, wenn die Finanzexport-Datei nicht im Export enthalten war. */
  status?: 'PAID' | 'PENDING' | 'CANCELLED'
  /** Sitzungsnamen (z.B. "OsKu_1_31.01.2026"), aus dem Notiz-Feld des Finanzexports geparst —
   *  zur Verknüpfung mit den bereits importierten TherapySession-Datensätzen. */
  sessionNames?: string[]
  profilNr: number | null
  patientName: string | null
  amount: number
  pdfFile: string | null
  /** Original-Rechnungsdatei (xlsx) als base64, für InvoiceDocument-Anlage beim Ausführen. */
  xlsxBase64?: string
  xlsxFilename?: string
}

export interface TpBmdRow {
  belegnr: string
  buchdatum: string
  belegdatum: string
  betrag: number
  text: string
  typ: 'E' | 'A'
}

export interface MigrationArea {
  id: string
  label: string
  emoji: string
  status: 'found' | 'empty' | 'unsupported' | 'pdf_only'
  count: number
  description: string
  canImport: boolean
  items: any[]
}

export interface MigrationPreview {
  areas: MigrationArea[]
  sourceHash: string
}

// ── ICD10-Label Lookup (subset der häufigsten in Psychotherapie) ───────────────
const ICD10_LABELS: Record<string, string> = {
  'F32.0': 'Leichte depressive Episode',
  'F32.1': 'Mittelgradige depressive Episode',
  'F32.2': 'Schwere depressive Episode ohne psychotische Symptome',
  'F32.9': 'Depressive Episode, nicht näher bezeichnet',
  'F33.0': 'Rezidivierende depressive Störung, gegenwärtig leichte Episode',
  'F33.1': 'Rezidivierende depressive Störung, gegenwärtig mittelgradige Episode',
  'F41.0': 'Panikstörung',
  'F41.1': 'Generalisierte Angststörung',
  'F41.2': 'Angst und depressive Störung, gemischt',
  'F40.1': 'Soziale Phobien',
  'F43.1': 'Posttraumatische Belastungsstörung',
  'F50.2': 'Bulimia nervosa',
  'F50.0': 'Anorexia nervosa',
  'F70': 'Leichte Intelligenzminderung',
  'Q90.9': 'Down-Syndrom, nicht näher bezeichnet',
  'F60.3': 'Emotional instabile Persönlichkeitsstörung',
}

function icdLabel(code: string): string {
  return ICD10_LABELS[code.trim()] ?? code.trim()
}

function parseDiagnoses(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === 'Keine') return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

// ── Excel lesen ────────────────────────────────────────────────────────────────
function readXlsx(filePath: string): any[][] {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false, blankrows: true }) as any[][]
}

// ── Einzelrechnung parsen ──────────────────────────────────────────────────────
function parseInvoiceXlsx(filePath: string, filename: string): TpInvoice | null {
  try {
    const fileBuf = fs.readFileSync(filePath)
    const wb = XLSX.read(fileBuf, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 'A', defval: null, raw: false, blankrows: true }) as any[]

    const get = (row: number, col: string): string | null => {
      const r = raw[row - 1]
      return r ? (r[col] ?? null) : null
    }

    const isExpense = filename.includes('_A') || filename.startsWith('A')
    if (isExpense) {
      // Ausgaben: nur Dateiname verfügbar (PDF), keine xlsx-Details
      return null
    }

    const invoiceNr = (get(6, 'C') ?? '').toString().trim()
    const dateRaw = (get(7, 'B') ?? '').toString().trim()
    const profilNrRaw = get(8, 'F')
    const profilNr = profilNrRaw ? parseInt(profilNrRaw.toString()) : null
    const patientName = (get(11, 'B') ?? '').toString().trim() || null
    const amountRaw = get(17, 'G')
    const amount = amountRaw ? parseFloat(amountRaw.toString().replace(',', '.')) : 0
    const paidDateRaw = raw.length >= 48 ? (raw[47]?.['B'] ?? null) : null
    const paidDate = paidDateRaw ? paidDateRaw.toString().trim() : null

    if (!invoiceNr) return null

    return {
      invoiceNr, type: 'INCOME',
      date: dateRaw, paidDate,
      profilNr, patientName, amount, pdfFile: null,
      // Original-Datei mitschleusen, damit sie beim Ausführen (execute-Route, separater
      // Request ohne Dateisystem-Zugriff mehr) als InvoiceDocument am Patienten hängt.
      xlsxBase64: fileBuf.toString('base64'),
      xlsxFilename: filename,
    }
  } catch {
    return null
  }
}

// ── Sessions-Export parsen ─────────────────────────────────────────────────────
function parseSessionsXlsx(filePath: string): TpSession[] {
  const rows = readXlsx(filePath)
  // Header ist Row 13 (index 12)
  const sessions: TpSession[] = []
  const HEADER_ROW = 12

  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r[0] == null) continue

    const profilNr = parseInt(r[0]?.toString() ?? '0')
    const sessionName = r[1]?.toString().trim() ?? ''
    const codeName = r[2]?.toString().trim() ?? ''
    const rawDiag = r[3]?.toString().trim() ?? ''
    const dateRaw = r[4]?.toString().trim() ?? ''
    const duration = parseInt(r[5]?.toString() ?? '50')
    const serviceLabel = r[6]?.toString().trim() ?? 'Einzeltherapie'
    const supervisionName = r[7]?.toString().trim() || null
    const supervisorName = r[8]?.toString().trim() || null
    const supervisionDate = r[9]?.toString().trim() || null

    // Sessionsnummer aus Sitzungsname extrahieren (z.B. "OsKu_3_26.02.2026" → 3)
    const numMatch = sessionName.match(/_(\d+)_/)
    const sessionNumber = numMatch ? parseInt(numMatch[1]) : i - HEADER_ROW

    sessions.push({
      profilNr, codeName, sessionName, sessionNumber,
      date: dateRaw.split(' ')[0], // Datum ohne Uhrzeit
      durationMinutes: duration,
      serviceLabel,
      diagnoses: parseDiagnoses(rawDiag),
      supervisionName, supervisorName, supervisionDate,
    })
  }
  return sessions
}

// ── Rechnungsverzeichnis scannen ───────────────────────────────────────────────
function parseAllInvoices(dir: string): { income: TpInvoice[]; expensePdfs: string[] } {
  const income: TpInvoice[] = []
  const expensePdfs: string[] = []

  const incomeDir = path.join(dir, 'Alle_Rechnungen_Einnahmen')
  const expenseDir = path.join(dir, 'Alle_Rechnungen_Ausgaben')

  if (fs.existsSync(incomeDir)) {
    for (const f of fs.readdirSync(incomeDir)) {
      if (!f.endsWith('.xlsx')) continue
      const inv = parseInvoiceXlsx(path.join(incomeDir, f), f)
      if (inv) income.push(inv)
    }
    income.sort((a, b) => a.invoiceNr.localeCompare(b.invoiceNr))
  }

  if (fs.existsSync(expenseDir)) {
    for (const f of fs.readdirSync(expenseDir)) {
      if (f.endsWith('.pdf')) expensePdfs.push(f)
    }
  }

  return { income, expensePdfs }
}

// ── Patienten aus Rechnungen + Sessions ableiten ───────────────────────────────
function derivePatients(invoices: TpInvoice[], sessions: TpSession[]): TpPatient[] {
  const byProfilNr = new Map<number, TpPatient>()

  // Aus Rechnungen: Name, Adresse, Betrag, Diagnosen
  for (const inv of invoices) {
    if (!inv.profilNr || !inv.patientName) continue
    if (!byProfilNr.has(inv.profilNr)) {
      const parts = inv.patientName.trim().split(' ')
      const lastName = parts[0] ?? ''
      const firstName = parts.slice(1).join(' ') || parts[0]
      byProfilNr.set(inv.profilNr, {
        profilNr: inv.profilNr,
        codeName: '',
        firstName, lastName, fullName: inv.patientName,
        street: null, city: null,
        diagnoses: [], method: null,
        unitPriceNet: inv.amount || null,
        unitDurationMinutes: null,
      })
    }
  }

  // Aus Sessions: Codename, Diagnosen ergänzen
  for (const s of sessions) {
    if (!byProfilNr.has(s.profilNr)) {
      // Patient nur in Sessions, nicht in Rechnungen → mit Codename anlegen
      byProfilNr.set(s.profilNr, {
        profilNr: s.profilNr, codeName: s.codeName,
        firstName: '–', lastName: s.codeName, fullName: s.codeName,
        street: null, city: null,
        diagnoses: s.diagnoses, method: null,
        unitPriceNet: null, unitDurationMinutes: s.durationMinutes,
      })
    } else {
      const p = byProfilNr.get(s.profilNr)!
      if (!p.codeName) p.codeName = s.codeName
      if (s.diagnoses.length > 0 && p.diagnoses.length === 0) p.diagnoses = s.diagnoses
      if (!p.unitDurationMinutes) p.unitDurationMinutes = s.durationMinutes
    }
  }

  return Array.from(byProfilNr.values()).sort((a, b) => a.profilNr - b.profilNr)
}

// ── BMD CSV parsen ─────────────────────────────────────────────────────────────
function parseBmdCsv(filePath: string): TpBmdRow[] {
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  const rows: TpBmdRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';')
    if (cols.length < 18) continue
    const betrag = parseFloat(cols[9].replace(',', '.') || '0')
    const konto = cols[1]
    // Erlöskonto → Einnahme (konto 4xxx). Alles andere (2xxx/7xxx/9xxx: Bank-,
    // Aufwands- oder Eigenkapitalkonten wie Privateinlagen) → nicht als Einnahme
    // zählen. Vorher stand hier fälschlich auch "2xxx" bei 'E' (widersprach dem
    // Kommentar) — führte dazu, dass z.B. Privateinlagen als Honorareinnahme
    // importiert wurden.
    const typ: 'E' | 'A' = konto.startsWith('4') ? 'E' : 'A'
    rows.push({
      belegnr: cols[16]?.trim() ?? '',
      buchdatum: cols[5]?.trim() ?? '',
      belegdatum: cols[6]?.trim() ?? '',
      betrag, text: cols[12]?.replace(/^"|"$/g, '').trim() ?? '',
      typ,
    })
  }
  return rows
}

// ── SHA256 Hash ────────────────────────────────────────────────────────────────
export async function sha256(buffer: Buffer): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(buffer).digest('hex')
}

// ── Finanzexport: echten Zahlungsstatus je Rechnungsnummer ermitteln ──────────
// WICHTIG: Die einzelnen Rechnungs-xlsx (Alle_Rechnungen_Einnahmen/) enthalten
// KEINEN echten Zahlungsstatus — Zeile 46-48 ist nur der wiederholte Zahlschein-
// Footer (IBAN + Fälligkeitsdatum), kein Zahlungsnachweis. Der tatsächliche
// Status/das Zahlungsdatum steht nur in der Finanzexport-Gesamtübersicht
// ("Finanzen_<von>_bis_<bis>.xlsx"), in zwei nebeneinanderliegenden Blöcken:
//   - "Abgeschlossene Transaktionen": Spalte J = Ref.Nr., Spalte E = Status
//     ("Bezahlt am DD.MM.YYYY" | "Storniert am DD.MM.YYYY" | "Erstellt am DD.MM.YYYY")
//   - "Offene Transaktionen": Spalte S = Ref.Nr., Spalte O = Status ("Nicht bezahlt")
// Beide Blöcke sind unabhängige Listen (kein Zeilen-Zusammenhang zwischen J/E und S/O).
interface TpFinanceStatus {
  status: 'PAID' | 'PENDING' | 'CANCELLED'
  paidDate: string | null
  sessionNames: string[]
}
// Extrahiert Sitzungsnamen aus Notiz-Text wie:
// "Zu dieser Transaktionen gehören die Sessions mit den Namen:\n - OsKu_1_31.01.2026 [Einzeltherapie]\n - ..."
function extractSessionNames(notiz: string | null | undefined): string[] {
  if (!notiz) return []
  const names: string[] = []
  for (const line of notiz.split('\n')) {
    const m = line.trim().match(/^-+\s*(\S+)/)
    if (m) names.push(m[1])
  }
  return names
}
function parseFinanzexportStatus(exportDir: string): Map<string, TpFinanceStatus> {
  const map = new Map<string, TpFinanceStatus>()
  const file = fs.readdirSync(exportDir).find(f => /^Finanzen_.*\.xlsx$/i.test(f))
  if (!file) return map

  try {
    const wb = XLSX.read(fs.readFileSync(path.join(exportDir, file)), { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    // blankrows:true ist entscheidend — sonst verschieben sich die Zeilenindizes
    // durch die Leerzeilen im Kopfbereich (gleicher Bug wie bei den Rechnungs-xlsx).
    const raw = XLSX.utils.sheet_to_json(ws, { header: 'A', defval: null, raw: false, blankrows: true }) as any[]

    for (let i = 13; i < raw.length; i++) { // Header in Zeile 14 (Index 13), Daten ab Zeile 15
      const r = raw[i]
      if (!r) continue

      const refLeft = (r['J'] ?? '').toString().trim()
      if (refLeft) {
        const statusLeft = (r['E'] ?? '').toString().trim()
        const sessionNames = extractSessionNames(r['I'])
        const paidM = statusLeft.match(/^Bezahlt am (\d{2}\.\d{2}\.\d{4})/)
        const cancelM = statusLeft.match(/^Storniert am (\d{2}\.\d{2}\.\d{4})/)
        if (paidM) map.set(refLeft, { status: 'PAID', paidDate: paidM[1], sessionNames })
        else if (cancelM) map.set(refLeft, { status: 'CANCELLED', paidDate: cancelM[1], sessionNames })
        else map.set(refLeft, { status: 'PENDING', paidDate: null, sessionNames }) // z.B. "Erstellt am ..."
      }

      const refRight = (r['S'] ?? '').toString().trim()
      if (refRight && !map.has(refRight)) {
        map.set(refRight, { status: 'PENDING', paidDate: null, sessionNames: extractSessionNames(r['R']) })
      }
    }
  } catch {
    // Finanzexport nicht lesbar — Map bleibt leer, Aufrufer fällt auf alten Stand zurück
  }

  return map
}

// ── Haupt-Parse-Funktion ───────────────────────────────────────────────────────
export function parseTherapsyExport(exportDir: string): Omit<MigrationPreview, 'sourceHash'> {
  // 1. Sessions
  const sessionsFile = fs.readdirSync(exportDir).find(f => f.startsWith('Sessions'))
  const sessions = sessionsFile
    ? parseSessionsXlsx(path.join(exportDir, sessionsFile))
    : []

  // 2. Rechnungen
  const { income: invoices, expensePdfs } = parseAllInvoices(exportDir)

  // 2b. Echten Zahlungsstatus aus Finanzexport-Gesamtübersicht ergänzen
  //     (die Einzel-Rechnungs-xlsx enthalten keinen verlässlichen Status, siehe oben)
  const financeStatus = parseFinanzexportStatus(exportDir)
  for (const inv of invoices) {
    const fs2 = financeStatus.get(inv.invoiceNr)
    if (fs2) {
      inv.status = fs2.status
      inv.paidDate = fs2.paidDate
      inv.sessionNames = fs2.sessionNames
    }
  }

  // 3. Patienten ableiten
  const patients = derivePatients(invoices, sessions)

  // 4. BMD CSV
  const bmdCsv = path.join(exportDir, 'BMDExport', 'BMDExport.csv')
  const bmdRows = parseBmdCsv(bmdCsv)

  // 5. Supervision aus Sessions
  const supervisions = sessions.filter(s => s.supervisionName)

  // 6. Alle Bereiche zusammenstellen
  const areas: MigrationArea[] = [
    {
      id: 'profiles',
      label: 'Klient:innen / Profile',
      emoji: '👤',
      status: patients.length > 0 ? 'found' : 'empty',
      count: patients.length,
      description: 'Name, Codename, Adresse, ICD10-Diagnosen, Abrechnungseinstellungen.',
      canImport: patients.length > 0,
      items: patients,
    },
    {
      id: 'sessions',
      label: 'Sitzungen',
      emoji: '🗓️',
      status: sessions.length > 0 ? 'found' : 'empty',
      count: sessions.length,
      description: 'Datum, Dauer, Leistungsbezeichnung, Diagnosen, Supervisionsstatus.',
      canImport: sessions.length > 0,
      items: sessions,
    },
    {
      id: 'kurzprotokoll',
      label: 'Kurzprotokolle',
      emoji: '📝',
      status: 'empty',
      count: 0,
      description: 'Kurzprotokoll-Inhalte (Thema, Hypothese, Intervention …) waren nicht eingegeben und sind daher nicht im Export enthalten.',
      canImport: false,
      items: [],
    },
    {
      id: 'langprotokoll',
      label: 'Langprotokolle',
      emoji: '📄',
      status: 'empty',
      count: 0,
      description: 'Langprotokoll-Inhalte waren nicht eingegeben und sind daher nicht im Export enthalten.',
      canImport: false,
      items: [],
    },
    {
      id: 'dokumente',
      label: 'Session-Dokumente',
      emoji: '📎',
      status: 'empty',
      count: 0,
      description: 'Angehängte Dokumente sind in TheraPsy nicht exportierbar. Diese müssen manuell im jeweiligen Patientenprofil in KDS hochgeladen werden.',
      canImport: false,
      items: [],
    },
    {
      id: 'audio',
      label: 'Audio-Aufnahmen',
      emoji: '🎙️',
      status: 'empty',
      count: 0,
      description: 'KDS unterstützt jetzt Audio-Aufnahmen (Sitzungen → Tab "Audio" / Patientenprofil → Audio-Bereich). TheraPsy exportiert Aufnahmen jedoch nicht — diese müssen manuell neu aufgenommen oder als Datei hochgeladen werden.',
      canImport: false,
      items: [],
    },
    {
      id: 'rechnungen_einnahmen',
      label: 'Honorarnoten / Einnahmen',
      emoji: '💶',
      status: invoices.length > 0 ? 'found' : 'empty',
      count: invoices.length,
      description: 'Alle Einnahmen-Rechnungen mit Rechnungsnummer, Datum, Betrag und Zahlungsstatus.',
      canImport: invoices.length > 0,
      items: invoices,
    },
    {
      id: 'rechnungen_ausgaben',
      label: 'Ausgaben-Rechnungen',
      emoji: '💸',
      status: expensePdfs.length > 0 ? 'pdf_only' : 'empty',
      count: expensePdfs.length,
      description: 'Ausgaben-Rechnungen liegen nur als PDF vor — strukturierte Daten sind nicht extrahierbar. Werden als manuelle Legacy-Buchungen importiert.',
      canImport: false,
      items: expensePdfs.map(f => ({ filename: f })),
    },
    {
      id: 'finanzexport',
      label: 'Finanz-Buchungssätze (BMD)',
      emoji: '🏦',
      status: bmdRows.length > 0 ? 'found' : 'empty',
      count: bmdRows.length,
      description: 'Buchungssätze aus dem BMD-Export. Werden als Legacy-Finanztransaktionen importiert.',
      canImport: bmdRows.length > 0,
      items: bmdRows,
    },
    {
      id: 'supervision',
      label: 'Supervision',
      emoji: '👁️',
      status: supervisions.length > 0 ? 'found' : 'empty',
      count: supervisions.length,
      description: 'Supervisionseinträge die mit Sitzungen verknüpft sind (Supervisor:in, Datum).',
      canImport: supervisions.length > 0,
      items: supervisions,
    },
  ]

  return { areas }
}
