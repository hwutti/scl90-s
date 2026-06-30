import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { MigrationPreview, TpPatient, TpSession, TpInvoice, TpExpense, TpSupervision } from '@/lib/migration/therapsy'

export const runtime = 'nodejs'
export const maxDuration = 120

interface RunResult {
  patients: { created: number; skipped: number }
  sessions: { created: number; skipped: number }
  invoices: { created: number; skipped: number }
  expenses: { count: number; note: string }
  supervisions: { created: number; skipped: number }
  warnings: string[]
}

// POST /api/admin/migration/run
// Body: { preview: MigrationPreview } (the full parsed data from /upload)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Nur Admins dürfen die Migration durchführen.' }, { status: 403 })

  const userId = (session.user as any).id
  const body = await req.json() as { preview: MigrationPreview }
  const { preview } = body
  if (!preview) return NextResponse.json({ error: 'Keine Preview-Daten übermittelt.' }, { status: 400 })

  const result: RunResult = {
    patients: { created: 0, skipped: 0 },
    sessions: { created: 0, skipped: 0 },
    invoices: { created: 0, skipped: 0 },
    expenses: { count: preview.expenses?.length ?? 0, note: 'PDF-Ausgaben können nicht automatisch importiert werden.' },
    supervisions: { created: 0, skipped: 0 },
    warnings: [...(preview.warnings ?? [])],
  }

  // ── 1. Patienten importieren ─────────────────────────────────────────────
  const patientIdByProfileNum = new Map<number, string>()

  for (const tp of (preview.patients ?? [])) {
    // Idempotenz: check by codeName (tpCodename) oder Name
    const existing = await prisma.patient.findFirst({
      where: {
        OR: [
          { codeName: tp.tpCodename || undefined },
          { firstName: tp.firstName, lastName: tp.lastName },
        ],
        createdByUserId: userId,
      },
      select: { id: true },
    })

    if (existing) {
      patientIdByProfileNum.set(tp.tpProfileNum, existing.id)
      result.patients.skipped++
      continue
    }

    // DOB: kein Datum in TheraPsy-Export → Platzhalter "0000-01-01"
    try {
      const created = await prisma.patient.create({
        data: {
          firstName: tp.firstName || tp.tpCodename,
          lastName: tp.lastName || '',
          dob: '1900-01-01',   // kein DOB im Export – muss manuell nachgetragen werden
          gender: 'DIVERSE',   // unbekannt – muss manuell nachgetragen werden
          phone: null, email: null,
          billRecipientAddress: tp.street ?? undefined,
          billRecipientCity: tp.city ?? undefined,
          codeName: tp.tpCodename || null,
          codeNameAuto: false,
          defaultBillingMode: 'unit',
          defaultUnitDuration: tp.unitDurationMin ?? 50,
          defaultUnitPriceNet: tp.unitPriceNet ?? undefined,
          createdByUserId: userId,
          // Migrationsvermerk in notes (über PatientRecord)
        },
        select: { id: true },
      })

      // Therapiemethode + ICD10 als Notiz im PatientRecord speichern
      const recordNote = [
        tp.therapyMethod ? `Psychotherapiemethode: ${tp.therapyMethod}` : '',
        tp.icd10.length > 0 ? `ICD10-Diagnosen: ${tp.icd10.join(', ')}` : '',
        `TheraPsy-Profil-Nr.: ${tp.tpProfileNum} (Codename: ${tp.tpCodename})`,
        '⚠ Bitte Geburtsdatum und Geschlecht manuell nachtragen (nicht im TheraPsy-Export enthalten).',
      ].filter(Boolean).join('\n')

      await prisma.patientRecord.upsert({
        where: { patientId: created.id },
        create: { patientId: created.id, notes: recordNote },
        update: { notes: recordNote },
      }).catch(() => {})  // PatientRecord existiert evtl. nicht als Modell

      patientIdByProfileNum.set(tp.tpProfileNum, created.id)
      result.patients.created++
    } catch (e: any) {
      result.warnings.push(`Patient ${tp.fullName} (Profil ${tp.tpProfileNum}): ${e.message}`)
    }
  }

  // ── 2. Sitzungen importieren ─────────────────────────────────────────────
  // Zähler pro Patient für laufende Sitzungsnummer
  const sessionCounterByPatient = new Map<string, number>()

  for (const ts of (preview.sessions ?? [])) {
    const patientId = patientIdByProfileNum.get(ts.tpProfileNum)
    if (!patientId) { result.warnings.push(`Session ${ts.tpSessionName}: Kein Patient (Profil ${ts.tpProfileNum}) gefunden.`); continue }

    // Idempotenz: check by name + patientId
    const existing = await prisma.therapySession.findFirst({
      where: { patientId, name: ts.tpSessionName },
      select: { id: true },
    })
    if (existing) { result.sessions.skipped++; continue }

    const counter = (sessionCounterByPatient.get(patientId) ?? 0) + 1
    sessionCounterByPatient.set(patientId, counter)

    try {
      await prisma.therapySession.create({
        data: {
          patientId,
          therapistId: userId,
          name: ts.tpSessionName,
          sessionNumber: counter,
          codeName: ts.tpCodename,
          source: 'MANUAL',
          sessionDate: ts.sessionDate,
          durationMinutes: ts.durationMinutes,
          serviceLabel: ts.serviceLabel,
          billingMode: 'unit',
          unitCount: 1,
          unitLengthMinutes: ts.durationMinutes,
          billingStatus: 'BILLED',   // bereits abgerechnet in TheraPsy
          excludedFromFinances: true, // wird über FinanceTransaction abgebildet
        },
      })
      result.sessions.created++
    } catch (e: any) {
      result.warnings.push(`Session ${ts.tpSessionName}: ${e.message}`)
    }
  }

  // ── 3. Rechnungen als FinanceTransactions importieren ────────────────────
  for (const inv of (preview.invoices ?? [])) {
    const patientId = patientIdByProfileNum.get(inv.tpProfileNum)

    // Idempotenz: check by invoiceNumber
    const existing = await prisma.financeTransaction.findFirst({
      where: { invoiceNumber: inv.invoiceNumber },
      select: { id: true },
    })
    if (existing) { result.invoices.skipped++; continue }

    try {
      await prisma.financeTransaction.create({
        data: {
          createdBy: userId,
          type: 'INCOME',
          amount: inv.amountNet || 0,
          date: inv.paidDate ?? inv.invoiceDate,
          paymentStatus: inv.paidDate ? 'PAID' : 'PENDING',
          incomeCategory: 'HONORAR',
          invoiceNumber: inv.invoiceNumber,
          description: `TheraPsy-Import: ${inv.invoiceNumber}`,
          patientId: patientId ?? undefined,
          note: `Import aus TheraPsy | Rechnungsdatum: ${inv.invoiceDate.toLocaleDateString('de-AT')}${inv.paidDate ? ` | Bezahlt: ${inv.paidDate.toLocaleDateString('de-AT')}` : ' | Zahlungsstatus unbekannt'}`,
        },
      })
      result.invoices.created++
    } catch (e: any) {
      result.warnings.push(`Rechnung ${inv.invoiceNumber}: ${e.message}`)
    }
  }

  // ── 4. Supervisionen importieren ─────────────────────────────────────────
  for (const sv of (preview.supervisions ?? [])) {
    // Idempotenz: check by name
    const existing = await prisma.supervisionEntry.findFirst({
      where: { superviseeId: userId, name: sv.supervisionName },
      select: { id: true },
    })
    if (existing) { result.supervisions.skipped++; continue }

    try {
      await prisma.supervisionEntry.create({
        data: {
          superviseeId: userId,
          supervisorName: sv.supervisorName,
          name: sv.supervisionName,
          date: sv.supervisionDate,
          durationMinutes: 50,
          supervisionType: 'INDIVIDUAL',
          content: `TheraPsy-Import | Klient-Codename: ${sv.tpCodename} | Sitzung: ${sv.tpSessionName}`,
          fachspezifikum: false,
          approved: false,
        },
      })
      result.supervisions.created++
    } catch (e: any) {
      result.warnings.push(`Supervision ${sv.supervisionName}: ${e.message}`)
    }
  }

  // ── AuditLog ─────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'MIGRATION_IMPORTED',
      details: {
        source: 'therapsy',
        patients: result.patients,
        sessions: result.sessions,
        invoices: result.invoices,
        supervisions: result.supervisions,
      },
    },
  }).catch(() => {})

  return NextResponse.json(result)
}
