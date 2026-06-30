import * as XLSX from 'xlsx'
import { execSync } from 'child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface TpPatient {
  tpProfileNum: number
  tpCodename: string       // z.B. "OsKu"
  firstName: string
  lastName: string
  fullName: string
  street: string | null
  city: string | null
  icd10: string[]
  therapyMethod: string | null
  unitPriceNet: number | null
  unitDurationMin: number | null
}

export interface TpSession {
  tpProfileNum: number
  tpCodename: string
  tpSessionName: string    // z.B. "OsKu_1_31.01.2026"
  sessionDate: Date
  durationMinutes: number
  serviceLabel: string
  icd10: string[]
  supervisionName: string | null
  supervisorName: string | null
  supervisionDate: Date | null
}

export interface TpInvoice {
  invoiceNumber: string    // z.B. "E26001"
  tpProfileNum: number
  invoiceDate: Date
  paidDate: Date | null
  amountNet: number
  sessions: { date: Date; units: number; service: string; unitPrice: number }[]
}

export interface TpExpense {
  filename: string
  invoiceNumber: string
  note: string
}

export interface TpSupervision {
  tpSessionName: string
  tpCodename: string
  sessionDate: Date
  supervisionName: string
  supervisorName: string
  supervisionDate: Date
}

export interface MigrationPreview {
  // Kategorien
  patients: TpPatient[]
  sessions: TpSession[]
  invoices: TpInvoice[]
  expenses: TpExpense[]
  supervisions: TpSupervision[]

  // Leere/nicht-vorhandene Kategorien (nur Metadaten)
  emptyCategories: {
    kurzprotokoll: { count: 0; reason: string }
    langprotokoll: { count: 0; reason: string }
    sessionDokumente: { count: 0; reason: string }
    audioAufnahmen: { count: 0; reason: string }
    bestaetigung: { count: 0; reason: string }
  }

  // Fehler/Warnungen beim Parsen
  warnings: string[]
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function parseAtDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const str = String(s).trim()
  // DD.MM.YYYY or DD.MM.YYYY HH:MM
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00Z`)
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str)
  return null
}

function extractIcd10(raw: string | null | undefined): string[] {
  if (!raw || String(raw).trim() === 'Keine') return []
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  const lastName = parts.pop()!
  return { firstName: parts.join(' '), lastName }
}

// ─── Invoice-Parser ───────────────────────────────────────────────────────────

function parseInvoiceXlsx(buffer: Buffer): { patient: Partial<TpPatient>; invoice: TpInvoice } | null {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return null

    // Alle Zellen als array-of-arrays (1-indexed rows → 0-indexed here)
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][]

    // Profil-Nummer (F8 = row[7][5])
    const tpProfileNum = parseInt(String(rows[7]?.[5] ?? '0'))
    if (!tpProfileNum) return null

    // Rechnungsnummer (C6 = row[5][2])
    const invoiceNumber = String(rows[5]?.[2] ?? '').trim()

    // Rechnungsdatum (B7 = row[6][1])
    const invoiceDate = parseAtDate(String(rows[6]?.[1] ?? '').trim()) ?? new Date()

    // Patient (B11-B13 = rows[10-12][1])
    const fullName = String(rows[10]?.[1] ?? '').trim()
    const street = String(rows[11]?.[1] ?? '').trim() || null
    const city = String(rows[12]?.[1] ?? '').trim() || null

    // ICD10 (F34 = row[33][5])
    const icd10 = extractIcd10(rows[33]?.[5])

    // Therapiemethode (F33 = row[32][5])
    const therapyMethod = String(rows[32]?.[5] ?? '').trim() || null

    // Einheitenpreis aus B30 "N Einheit (X Min.) zu je Y €"
    let unitPriceNet: number | null = null
    let unitDurationMin: number | null = null
    const unitDesc = String(rows[29]?.[1] ?? '')
    const unitMatch = unitDesc.match(/\((\d+)\s*Min\.\)\s*zu\s*je\s*([\d,]+)/i)
    if (unitMatch) {
      unitDurationMin = parseInt(unitMatch[1])
      unitPriceNet = parseFloat(unitMatch[2].replace(',', '.'))
    }

    // Sessions-Zeilen (Rows 17-24 = indices 16-23)
    const sessions: TpInvoice['sessions'] = []
    for (let i = 16; i <= 23; i++) {
      const row = rows[i]
      if (!row?.[1]) break  // B leer = keine weiteren Sessions
      const dateVal = parseAtDate(String(row[1]))
      if (!dateVal) break
      const units = parseFloat(String(row[2] ?? '1').replace(',', '.')) || 1
      const service = String(row[4] ?? 'Einzeltherapie').trim()
      const price = parseFloat(String(row[6] ?? unitPriceNet ?? 0).replace(',', '.')) || 0
      sessions.push({ date: dateVal, units, service, unitPrice: price })
    }

    // Gesamtbetrag: G25 (row[24][6]) – falls SheetJS cached value hat; sonst aus Sessions
    let amountNet = parseFloat(String(rows[24]?.[6] ?? '0').replace(',', '.'))
    if (!amountNet || amountNet === 0) {
      amountNet = sessions.reduce((s, r) => s + r.units * r.unitPrice, 0)
    }
    if (!amountNet && unitPriceNet) {
      amountNet = unitPriceNet  // Fallback
    }

    // Zahlungsdatum: B48 (row[47][1]) – hat TheraPsy oft mit dem Bezahlt-Datum befüllt
    const paidDate = parseAtDate(rows[47]?.[1])

    // Codename aus Sitzungsname ableiten (z.B. "OsKu_1_31.01.2026" → "OsKu")
    const tpCodename = sessions[0] ? '' : ''  // wird aus Sessions-File befüllt

    const { firstName, lastName } = splitName(fullName)

    return {
      patient: {
        tpProfileNum,
        tpCodename: '',  // wird später aus sessions-file ergänzt
        firstName, lastName, fullName,
        street, city, icd10, therapyMethod, unitPriceNet, unitDurationMin,
      },
      invoice: {
        invoiceNumber, tpProfileNum, invoiceDate, paidDate,
        amountNet, sessions,
      },
    }
  } catch {
    return null
  }
}

// ─── Sessions-Parser ─────────────────────────────────────────────────────────

function parseSessionsXlsx(buffer: Buffer): { sessions: TpSession[]; supervisions: TpSupervision[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][]

  const sessions: TpSession[] = []
  const supervisions: TpSupervision[] = []

  // Header is at row 13 (index 12), data from row 14 (index 13)+
  // Skip non-data rows by looking for numeric profil number in column 0
  for (let i = 13; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const profileNum = parseInt(String(row[0] ?? ''))
    if (isNaN(profileNum)) continue

    const tpSessionName = String(row[1] ?? '').trim()
    const tpCodename = String(row[2] ?? '').trim()
    const icd10 = extractIcd10(row[3])
    const sessionDate = parseAtDate(String(row[4] ?? ''))
    const duration = parseInt(String(row[5] ?? '50')) || 50
    const service = String(row[6] ?? 'Einzeltherapie').trim()
    const supervisionName = String(row[7] ?? '').trim() || null
    const supervisorName = String(row[8] ?? '').trim() || null
    const supervisionDate = parseAtDate(String(row[9] ?? ''))

    if (!sessionDate || !tpCodename) continue

    sessions.push({
      tpProfileNum: profileNum,
      tpCodename,
      tpSessionName,
      sessionDate,
      durationMinutes: duration,
      serviceLabel: service,
      icd10,
      supervisionName,
      supervisorName,
      supervisionDate,
    })

    if (supervisionName && supervisorName && supervisionDate) {
      supervisions.push({
        tpSessionName,
        tpCodename,
        sessionDate,
        supervisionName,
        supervisorName,
        supervisionDate,
      })
    }
  }

  return { sessions, supervisions }
}

// ─── Hauptfunktion: RAR parsen ───────────────────────────────────────────────

export async function parseTherapsyRar(rarBuffer: Buffer): Promise<MigrationPreview> {
  const tmpDir = `/tmp/kds_migration_${Date.now()}`
  const warnings: string[] = []

  try {
    mkdirSync(tmpDir, { recursive: true })

    // RAR auf Disk schreiben und extrahieren
    const rarPath = join(tmpDir, 'export.rar')
    const { writeFileSync } = await import('fs')
    writeFileSync(rarPath, rarBuffer)

    try {
      execSync(`unrar x -y "${rarPath}" "${tmpDir}/"`, { timeout: 60000, stdio: 'pipe' })
    } catch (e: any) {
      throw new Error(`RAR-Extraktion fehlgeschlagen: ${e.message}. Ist "unrar" auf dem Server installiert?`)
    }

    // Export-Verzeichnis finden
    let exportDir = tmpDir
    const topDirs = readdirSync(tmpDir).filter(f => f.startsWith('Export_'))
    if (topDirs.length > 0) exportDir = join(tmpDir, topDirs[0])

    // ── Sessions-Datei parsen (wichtigste Quelle) ─────────────────────────
    let allSessions: TpSession[] = []
    let allSupervisions: TpSupervision[] = []
    const sessionFiles = readdirSync(exportDir).filter(f => f.startsWith('Sessions') && f.endsWith('.xlsx'))
    if (sessionFiles.length > 0) {
      const buf = readFileSync(join(exportDir, sessionFiles[0]))
      const { sessions, supervisions } = parseSessionsXlsx(buf)
      allSessions = sessions
      allSupervisions = supervisions
    } else {
      warnings.push('SessionsMitSupervisionen.xlsx nicht gefunden – Sitzungsdaten fehlen.')
    }

    // Codename-Map aufbauen: profileNum → codename
    const codenameMap = new Map<number, string>()
    for (const s of allSessions) codenameMap.set(s.tpProfileNum, s.tpCodename)

    // ── Rechnungen parsen ─────────────────────────────────────────────────
    const invoiceDir = join(exportDir, 'Alle_Rechnungen_Einnahmen')
    const patientMap = new Map<number, TpPatient>()
    const allInvoices: TpInvoice[] = []

    if (existsSync(invoiceDir)) {
      const invoiceFiles = readdirSync(invoiceDir).filter(f => f.endsWith('.xlsx')).sort()
      for (const fname of invoiceFiles) {
        const buf = readFileSync(join(invoiceDir, fname))
        const result = parseInvoiceXlsx(buf)
        if (!result) { warnings.push(`Konnte ${fname} nicht parsen – übersprungen.`); continue }

        const { patient: p, invoice } = result

        // Codename aus Sessions-Map ergänzen
        p.tpCodename = codenameMap.get(p.tpProfileNum!) ?? ''

        // Patient deduplizieren (by profileNum)
        if (!patientMap.has(p.tpProfileNum!)) {
          patientMap.set(p.tpProfileNum!, p as TpPatient)
        } else {
          // ICD10 aktualisieren wenn neue Diagnosen
          const existing = patientMap.get(p.tpProfileNum!)!
          for (const code of (p.icd10 ?? [])) {
            if (!existing.icd10.includes(code)) existing.icd10.push(code)
          }
        }

        allInvoices.push(invoice)
      }
    } else {
      warnings.push('Ordner Alle_Rechnungen_Einnahmen nicht gefunden.')
    }

    // Patienten ohne Invoice-Daten (nur aus Sessions) auffüllen
    for (const s of allSessions) {
      if (!patientMap.has(s.tpProfileNum)) {
        const parts = s.tpCodename.split('')  // Codename = "OsKu" etc.
        patientMap.set(s.tpProfileNum, {
          tpProfileNum: s.tpProfileNum,
          tpCodename: s.tpCodename,
          firstName: s.tpCodename, lastName: '',
          fullName: s.tpCodename,
          street: null, city: null,
          icd10: s.icd10,
          therapyMethod: null,
          unitPriceNet: null, unitDurationMin: null,
        })
      }
    }

    // ── Ausgaben parsen ──────────────────────────────────────────────────
    const expenseDir = join(exportDir, 'Alle_Rechnungen_Ausgaben')
    const allExpenses: TpExpense[] = []
    if (existsSync(expenseDir)) {
      for (const fname of readdirSync(expenseDir)) {
        // z.B. "Rechnung_A26001_bestNet Psyonline RG.pdf"
        const m = fname.match(/Rechnung_(A\d+)_(.+)\.(pdf|xlsx)$/i)
        allExpenses.push({
          filename: fname,
          invoiceNumber: m?.[1] ?? fname,
          note: m?.[2]?.replace(/_/g, ' ') ?? fname,
        })
      }
    }

    return {
      patients: Array.from(patientMap.values()).sort((a, b) => a.tpProfileNum - b.tpProfileNum),
      sessions: allSessions,
      invoices: allInvoices,
      expenses: allExpenses,
      supervisions: allSupervisions,
      emptyCategories: {
        kurzprotokoll: { count: 0, reason: 'In TheraPsy nicht ausgefüllt (Freitext-Felder waren leer).' },
        langprotokoll: { count: 0, reason: 'In TheraPsy nicht ausgefüllt (Freitext-Felder waren leer).' },
        sessionDokumente: { count: 0, reason: 'Keine Dokument-Anhänge in TheraPsy vorhanden.' },
        audioAufnahmen: { count: 0, reason: 'Keine Audio-Aufnahmen in TheraPsy vorhanden.' },
        bestaetigung: { count: 0, reason: 'Bestätigungen sind pro Profil abrufbar – im Export nicht als Datei enthalten.' },
      },
      warnings,
    }
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
