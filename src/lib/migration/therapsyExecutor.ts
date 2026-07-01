import { prisma } from '@/lib/prisma'
import type { TpPatient, TpSession, TpInvoice, TpBmdRow } from './therapsyParser'

export interface ExecuteOptions {
  userId: string
  selectedAreas: string[]
}

export interface ExecuteResult {
  patients: number
  patientsSkipped: number
  sessions: number
  sessionsSkipped: number
  transactions: number
  diagnoses: number
  supervisions: number
  warnings: string[]
}

// ── Datums-Helfer: DD.MM.YYYY oder YYYY-MM-DD → Date ──────────────────────────
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const cleaned = s.trim().split(' ')[0]
  const dmY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(cleaned)
  if (dmY) return new Date(parseInt(dmY[3]), parseInt(dmY[2]) - 1, parseInt(dmY[1]))
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned)
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]))
  return null
}

// ── ICD10-Labels (Teilmenge) ───────────────────────────────────────────────────
const ICD10_LABELS: Record<string, string> = {
  'F32.0': 'Leichte depressive Episode',
  'F32.1': 'Mittelgradige depressive Episode',
  'F32.2': 'Schwere depressive Episode ohne psychotische Symptome',
  'F32.9': 'Depressive Episode, nicht näher bezeichnet',
  'F41.0': 'Panikstörung', 'F41.1': 'Generalisierte Angststörung',
  'F41.2': 'Angst und depressive Störung, gemischt',
  'F40.1': 'Soziale Phobien', 'F43.1': 'Posttraumatische Belastungsstörung',
  'F50.2': 'Bulimia nervosa', 'F50.0': 'Anorexia nervosa',
  'F70': 'Leichte Intelligenzminderung', 'Q90.9': 'Down-Syndrom, nicht näher bezeichnet',
  'F60.3': 'Emotional instabile Persönlichkeitsstörung',
}

export async function executeMigration(
  patients: TpPatient[],
  sessions: TpSession[],
  invoices: TpInvoice[],
  bmdRows: TpBmdRow[],
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  const result: ExecuteResult = {
    patients: 0, patientsSkipped: 0,
    sessions: 0, sessionsSkipped: 0,
    transactions: 0, diagnoses: 0, supervisions: 0,
    warnings: [],
  }
  const { userId, selectedAreas } = opts

  // Profil-Nr → KDS Patient-ID
  const patientIdByProfilNr = new Map<number, string>()

  // ── 1. Klient:innen ──────────────────────────────────────────────────────────
  if (selectedAreas.includes('profiles')) {
    for (const tp of patients) {
      // Deduplizieren über codeName, sonst über fullName
      const existing = tp.codeName
        ? await prisma.patient.findFirst({ where: { codeName: tp.codeName, createdByUserId: userId } })
        : await prisma.patient.findFirst({ where: { createdByUserId: userId, firstName: tp.firstName, lastName: tp.lastName } })

      if (existing) {
        patientIdByProfilNr.set(tp.profilNr, existing.id)
        result.patientsSkipped++
        continue
      }

      const patient = await prisma.patient.create({
        data: {
          firstName: tp.firstName,
          lastName: tp.lastName,
          dob: '0000-00-00',      // Pflichtfeld; TheraPsy exportiert kein Geburtsdatum → Platzhalter
          gender: 'DIVERSE',      // unbekannt → manuell nachzutragen
          codeName: tp.codeName || null,
          codeNameAuto: !tp.codeName,
          defaultUnitDuration: tp.unitDurationMinutes ?? 50,
          defaultUnitPriceNet: tp.unitPriceNet ?? undefined,
          createdByUserId: userId,
        },
      })

      patientIdByProfilNr.set(tp.profilNr, patient.id)

      // TherapistPatient-Verknüpfung
      await prisma.therapistPatient.upsert({
        where: { therapistId_patientId: { therapistId: userId, patientId: patient.id } },
        create: { therapistId: userId, patientId: patient.id, isPrimary: true },
        update: {},
      })

      // Diagnosen
      for (const code of tp.diagnoses) {
        await prisma.patientDiagnosis.create({
          data: {
            patientId: patient.id,
            createdBy: userId,
            icdCode: code.trim(),
            icdLabel: ICD10_LABELS[code.trim()] ?? code.trim(),
            diagnosisType: 'PRIMARY',
          },
        })
        result.diagnoses++
      }

      result.patients++
    }
  }

  // ── 2. Sitzungen ─────────────────────────────────────────────────────────────
  if (selectedAreas.includes('sessions')) {
    for (const s of sessions) {
      const patientId = patientIdByProfilNr.get(s.profilNr)
      if (!patientId) {
        result.warnings.push(`Sitzung ${s.sessionName}: Kein Patient für Profil-Nr. ${s.profilNr} — übersprungen`)
        result.sessionsSkipped++
        continue
      }

      const sessionDate = parseDate(s.date)
      if (!sessionDate) {
        result.warnings.push(`Sitzung ${s.sessionName}: Ungültiges Datum "${s.date}" — übersprungen`)
        result.sessionsSkipped++
        continue
      }

      // Deduplizieren über name + patient
      const existing = await prisma.therapySession.findFirst({
        where: { patientId, name: s.sessionName, therapistId: userId },
      })
      if (existing) { result.sessionsSkipped++; continue }

      const session = await prisma.therapySession.create({
        data: {
          patientId,
          therapistId: userId,
          name: s.sessionName,
          sessionNumber: s.sessionNumber,
          codeName: s.codeName || null,
          source: 'MANUAL',
          sessionDate,
          durationMinutes: s.durationMinutes,
          billingMode: 'time',
          serviceLabel: s.serviceLabel || null,
          billingStatus: 'EXCLUDED',       // bereits in TheraPsy abgerechnet
          excludedFromFinances: true,
        },
      })
      result.sessions++

      // Supervision
      if (s.supervisionName && selectedAreas.includes('supervision')) {
        const svDate = parseDate(s.supervisionDate) ?? sessionDate
        await prisma.supervisionEntry.create({
          data: {
            superviseeId: userId,
            sessionId: session.id,
            name: s.supervisionName,
            supervisorName: s.supervisorName ?? null,
            date: svDate,
            durationMinutes: s.durationMinutes,
            supervisionType: 'INDIVIDUAL',
            fachspezifikum: true,
          },
        })
        result.supervisions++
      }
    }
  }

  // ── 3. Honorarnoten/Einnahmen als Legacy-Transaktionen ───────────────────────
  if (selectedAreas.includes('rechnungen_einnahmen')) {
    for (const inv of invoices) {
      if (inv.type !== 'INCOME') continue
      const invoiceDate = parseDate(inv.date)
      if (!invoiceDate) {
        result.warnings.push(`Rechnung ${inv.invoiceNr}: Ungültiges Datum — übersprungen`)
        continue
      }

      // Deduplizieren über invoiceNumber
      const existing = await prisma.financeTransaction.findFirst({
        where: { invoiceNumber: inv.invoiceNr, createdBy: userId },
      })
      if (existing) continue

      const patientId = inv.profilNr ? (patientIdByProfilNr.get(inv.profilNr) ?? null) : null

      // Echten Zahlungsstatus verwenden, falls aus Finanzexport ermittelt (siehe therapsyParser.ts).
      // Fallback (Finanzexport nicht im Export enthalten): alte Heuristik + Warnhinweis.
      let paymentStatus: 'PAID' | 'PENDING' | 'CANCELLED'
      let statusNote: string
      if (inv.status) {
        paymentStatus = inv.status
        statusNote = inv.status === 'PAID' ? `bezahlt am ${inv.paidDate}`
                   : inv.status === 'CANCELLED' ? `storniert am ${inv.paidDate}`
                   : 'offen'
      } else {
        paymentStatus = inv.paidDate ? 'PAID' : 'PENDING'
        statusNote = inv.paidDate ? `bezahlt am ${inv.paidDate} (ungeprüft — Finanzexport fehlte)` : 'offen'
        result.warnings.push(`Rechnung ${inv.invoiceNr}: Zahlungsstatus nicht verifizierbar (Finanzexport-Datei fehlte im Export) — als "${paymentStatus}" markiert, bitte manuell prüfen.`)
      }

      await prisma.financeTransaction.create({
        data: {
          createdBy: userId,
          patientId,
          type: 'INCOME',
          amount: inv.amount,
          date: invoiceDate,
          paymentStatus,
          description: `Importiert aus TheraPsy: ${inv.invoiceNr} (${statusNote})`,
          invoiceNumber: inv.invoiceNr,
          incomeCategory: 'HONORAR',
        },
      })
      result.transactions++
    }
  }

  // ── 4. BMD-Buchungssätze als Legacy-Transaktionen ────────────────────────────
  if (selectedAreas.includes('finanzexport')) {
    for (const row of bmdRows) {
      const belegDate = parseDate(row.belegdatum) ?? parseDate(row.buchdatum)
      if (!belegDate) continue

      // Deduplizieren: gleicher Beleg + User
      const existing = await prisma.financeTransaction.findFirst({
        where: { invoiceNumber: row.belegnr || undefined, createdBy: userId, date: belegDate },
      })
      if (existing) continue

      await prisma.financeTransaction.create({
        data: {
          createdBy: userId,
          type: row.typ === 'E' ? 'INCOME' : 'EXPENSE',
          amount: Math.abs(row.betrag),
          date: belegDate,
          paymentStatus: 'PAID',
          description: row.text || `BMD-Buchung ${row.belegnr}`,
          invoiceNumber: row.belegnr || null,
          incomeCategory: row.typ === 'E' ? 'HONORAR' : undefined,
          expenseCategory: row.typ === 'A' ? 'MISC_BUSINESS' : undefined,
        },
      })
      result.transactions++
    }
  }

  return result
}
