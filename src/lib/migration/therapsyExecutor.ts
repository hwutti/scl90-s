import { prisma } from '@/lib/prisma'
import type { TpPatient, TpSession, TpInvoice, TpBmdRow } from './therapsyParser'

export interface ExecuteOptions {
  importProfiles: boolean
  importSessions: boolean
  importInvoices: boolean
  importBmd: boolean
  importSupervision: boolean
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
  // DD.MM.YYYY
  const dmY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(cleaned)
  if (dmY) return new Date(parseInt(dmY[3]), parseInt(dmY[2]) - 1, parseInt(dmY[1]))
  // YYYY-MM-DD
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned)
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]))
  return null
}

// ── ICD10-Labels (aus dem Parser, kleine Teilmenge) ───────────────────────────
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

  // Profil-Nr → KDS Patient-ID Mapping (wird schrittweise befüllt)
  const patientIdByProfilNr = new Map<number, string>()

  // ── 1. Klient:innen anlegen ──────────────────────────────────────────────────
  if (opts.selectedAreas.includes('profiles')) {
    for (const tp of patients) {
      // Doppelten Import verhindern: codeName als Eindeutigkeitsmerkmal
      const existing = tp.codeName
        ? await prisma.patient.findFirst({ where: { codeName: tp.codeName, createdByUserId: opts.userId } })
        : null

      if (existing) {
        patientIdByProfilNr.set(tp.profilNr, existing.id)
        result.patientsSkipped++
        continue
      }

      const nameParts = tp.fullName.trim().split(' ')
      const firstName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]
      const lastName = nameParts[0]

      const patient = await prisma.patient.create({
        data: {
          firstName, lastName,
          dob: '0000-00-00',  // Pflichtfeld in KDS, nicht in TheraPsy vorhanden → Platzhalter
          gender: 'DIVERSE',  // unbekannt → manuell nachzutragen
          codeName: tp.codeName || null,
          codeNameAuto: !tp.codeName,
          defaultUnitPriceNet: tp.unitPriceNet ?? undefined,
          defaultUnitDuration: tp.unitDurationMinutes ?? 50,
          createdByUserId: opts.userId,
          // Notiz: importiert aus TheraPsy
          importSource: `TheraPsy Profil-Nr. ${tp.profilNr}` as any,
        } as any,
      })

      patientIdByProfilNr.set(tp.profilNr, patient.id)

      // TherapistPatient-Verknüpfung
      await prisma.therapistPatient.upsert({
        where: { therapistId_patientId: { therapistId: opts.userId, patientId: patient.id } },
        create: { therapistId: opts.userId, patientId: patient.id, isPrimary: true },
        update: {},
      })

      // Diagnosen
      for (const code of tp.diagnoses) {
        await prisma.patientDiagnosis.create({
          data: {
            patientId: patient.id, createdBy: opts.userId,
            icdCode: code,
            icdLabel: ICD10_LABELS[code] ?? code,
            diagnosisType: 'PRIMARY',
          },
        })
        result.diagnoses++
      }

      result.patients++
    }
  }

  // ── 2. Sitzungen anlegen ──────────────────────────────────────────────────────
  if (opts.selectedAreas.includes('sessions')) {
    for (const s of sessions) {
      const patientId = patientIdByProfilNr.get(s.profilNr)
      if (!patientId) {
        result.warnings.push(`Sitzung ${s.sessionName}: Kein Patient für Profil-Nr. ${s.profilNr} gefunden — Sitzung übersprungen`)
        result.sessionsSkipped++
        continue
      }

      const sessionDate = parseDate(s.date)
      if (!sessionDate) {
        result.warnings.push(`Sitzung ${s.sessionName}: Ungültiges Datum "${s.date}" — übersprungen`)
        result.sessionsSkipped++
        continue
      }

      // Doppelten Import verhindern
      const existing = await prisma.therapySession.findFirst({
        where: { patientId, name: s.sessionName, therapistId: opts.userId },
      })
      if (existing) { result.sessionsSkipped++; continue }

      const session = await prisma.therapySession.create({
        data: {
          patientId, therapistId: opts.userId,
          name: s.sessionName,
          sessionNumber: s.sessionNumber,
          codeName: s.codeName || null,
          sessionDate,
          durationMinutes: s.durationMinutes,
          serviceLabel: s.serviceLabel,
          billingMode: 'time',
          source: 'MANUAL',
        },
      })
      result.sessions++

      // Supervision
      if (s.supervisionName && opts.selectedAreas.includes('supervision')) {
        const svDate = parseDate(s.supervisionDate)
        await prisma.supervisionEntry.create({
          data: {
            superviseeId: opts.userId,
            sessionId: session.id,
            name: s.supervisionName,
            supervisorName: s.supervisorName ?? null,
            date: svDate ?? new Date(),
            durationMinutes: s.durationMinutes,
            supervisionType: 'INDIVIDUAL',
            fachspezifikum: true,
          },
        })
        result.supervisions++
      }
    }
  }

  // ── 3. Einnahmen-Rechnungen als Legacy-Transaktionen ─────────────────────────
  if (opts.selectedAreas.includes('rechnungen_einnahmen')) {
    for (const inv of invoices) {
      if (inv.type !== 'INCOME') continue
      const invoiceDate = parseDate(inv.date)
      if (!invoiceDate) { result.warnings.push(`Rechnung ${inv.invoiceNr}: Ungültiges Datum — übersprungen`); continue }

      const existing = await prisma.financeTransaction.findFirst({
        where: { invoiceNumber: inv.invoiceNr, createdBy: opts.userId },
      })
      if (existing) continue

      const patientId = inv.profilNr ? (patientIdByProfilNr.get(inv.profilNr) ?? null) : null
      const paidDate = parseDate(inv.paidDate)

      await prisma.financeTransaction.create({
        data: {
          createdBy: opts.userId,
          patientId,
          type: 'INCOME',
          amount: inv.amount,
          date: invoiceDate,
          paymentStatus: paidDate ? 'PAID' : 'PENDING',
          paidAt: paidDate ?? null,
          description: `Importiert aus TheraPsy: ${inv.invoiceNr}`,
          invoiceNumber: inv.invoiceNr,
          incomeCategory: 'HONORAR',
        },
      })
      result.transactions++
    }
  }

  // ── 4. BMD-Buchungssätze als Legacy-Transaktionen ──────────────────────────
  if (opts.selectedAreas.includes('finanzexport')) {
    for (const row of bmdRows) {
      const belegDate = parseDate(row.belegdatum) ?? parseDate(row.buchdatum)
      if (!belegDate) continue

      const existing = await prisma.financeTransaction.findFirst({
        where: { invoiceNumber: row.belegnr, createdBy: opts.userId },
      })
      if (existing) continue

      await prisma.financeTransaction.create({
        data: {
          createdBy: opts.userId,
          type: row.typ === 'E' ? 'INCOME' : 'EXPENSE',
          amount: Math.abs(row.betrag),
          date: belegDate,
          paymentStatus: 'PAID',
          description: row.text,
          invoiceNumber: row.belegnr,
          incomeCategory: row.typ === 'E' ? 'HONORAR' : undefined,
          expenseCategory: row.typ === 'A' ? 'MISC_BUSINESS' : undefined,
        },
      })
      result.transactions++
    }
  }

  return result
}
