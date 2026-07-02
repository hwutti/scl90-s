import { prisma } from '@/lib/prisma'
import type { TpPatient, TpSession, TpInvoice, TpBmdRow, TpProtocol } from './therapsyParser'

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
  protocols: number
  protocolsSkipped: number
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

// ── Kurzprotokoll → kombinierter Notiz-Text ────────────────────────────────────
// Eine Notiz pro Sitzung mit klar beschrifteten Abschnitten (statt Aufsplittung
// in mehrere Einzelnotizen) — erhält den zusammenhängenden Charakter des
// Original-Kurzprotokolls. Leere Abschnitte werden weggelassen. Der führende
// Marker dient der Idempotenz (Wiedererkennung bei erneutem Migrationslauf).
function buildProtocolContent(p: TpProtocol): string {
  const sections: [string, string][] = [
    ['Thema der Stunde', p.thema],
    ['Verstehenshypothese', p.hypothese],
    ['Therapeutische Intervention', p.intervention],
    ['Therapeutische Ziele', p.ziele],
    ['Supervision', p.supervision],
  ]
  const parts = sections.filter(([, v]) => v).map(([label, v]) => `${label}:\n${v}`)
  return `[TheraPsy-Import: ${p.sessionName}]\n\n${parts.join('\n\n')}`
}

export async function executeMigration(
  patients: TpPatient[],
  sessions: TpSession[],
  invoices: TpInvoice[],
  bmdRows: TpBmdRow[],
  protocols: TpProtocol[],
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  const result: ExecuteResult = {
    patients: 0, patientsSkipped: 0,
    sessions: 0, sessionsSkipped: 0,
    transactions: 0, diagnoses: 0, supervisions: 0,
    protocols: 0, protocolsSkipped: 0,
    warnings: [],
  }
  const { userId, selectedAreas } = opts

  // Profil-Nr → KDS Patient-ID
  const patientIdByProfilNr = new Map<number, string>()
  // "patientId::sessionName" → TherapySession-ID (für Rechnungs-Zuordnung, Schritt 3)
  const sessionIdByPatientAndName = new Map<string, string>()

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
      if (existing) {
        sessionIdByPatientAndName.set(`${patientId}::${s.sessionName}`, existing.id)
        result.sessionsSkipped++
        continue
      }

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
      sessionIdByPatientAndName.set(`${patientId}::${s.sessionName}`, session.id)
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

  // Einmalig für Schritt 3+4: Name der Praxis/des Therapeuten als payeeName/payerName
  const therapistUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const praxisName = therapistUser?.name ?? 'Praxis'

  // ── 2b. Kurzprotokolle als Verlaufsnotizen (§16a) ────────────────────────────
  // Matching läuft bewusst über eine direkte DB-Abfrage nach Sitzungsname (nicht
  // über die in-memory sessionIdByPatientAndName-Map von oben), da dieser Schritt
  // auch in einem SEPARATEN, späteren Migrationslauf ausgeführt werden kann,
  // wenn die Sitzungen bereits aus einem früheren Lauf in der DB stehen.
  if (selectedAreas.includes('kurzprotokoll')) {
    for (const p of protocols) {
      const session = await prisma.therapySession.findFirst({
        where: { therapistId: userId, name: p.sessionName },
        select: { id: true, patientId: true, sessionDate: true },
      })
      if (!session) {
        result.warnings.push(`Kurzprotokoll ${p.sessionName}: Keine passende Sitzung gefunden — übersprungen`)
        result.protocolsSkipped++
        continue
      }

      // Idempotenz: bei erneutem Lauf nicht doppelt anlegen (Marker-Präfix erkennen)
      const marker = `[TheraPsy-Import: ${p.sessionName}]`
      const existing = await prisma.sessionNote.findFirst({
        where: { patientId: session.patientId, content: { startsWith: marker } },
      })
      if (existing) {
        result.protocolsSkipped++
        continue
      }

      await prisma.sessionNote.create({
        data: {
          patientId: session.patientId,
          authorId: userId,
          date: session.sessionDate,
          noteType: 'PROGRESS',
          content: buildProtocolContent(p),
        },
      })
      result.protocols++
    }
  }

  // ── 3. Honorarnoten/Einnahmen als echte Transaktionen ────────────────────────
  if (selectedAreas.includes('rechnungen_einnahmen')) {
    for (const inv of invoices) {
      if (inv.type !== 'INCOME') continue
      const invoiceDate = parseDate(inv.date)
      if (!invoiceDate) {
        result.warnings.push(`Rechnung ${inv.invoiceNr}: Ungültiges Datum — übersprungen`)
        continue
      }

      // Deduplizieren über referenceNumber (im neuen Modell eindeutig)
      const existing = await prisma.transaction.findUnique({ where: { referenceNumber: inv.invoiceNr } })
      if (existing) continue

      const patientId = inv.profilNr ? (patientIdByProfilNr.get(inv.profilNr) ?? null) : null

      // Echten Patientennamen als Zahler verwenden, falls schon importiert
      let payerName = inv.patientName ?? 'Unbekannt'
      if (patientId) {
        const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true, codeName: true } })
        if (p) payerName = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.codeName || payerName
      }

      // Echten Zahlungsstatus verwenden, falls aus Finanzexport ermittelt (siehe therapsyParser.ts).
      // TxPaymentStatus kennt nur PAID/UNPAID — "storniert" wird über lifecycleStatus abgebildet.
      let paymentStatus: 'PAID' | 'UNPAID' = 'UNPAID'
      let lifecycleStatus: 'ACTIVE' | 'CANCELLED_ORIGINAL' = 'ACTIVE'
      let paidAt: Date | null = null
      let statusNote: string
      if (inv.status === 'PAID') {
        paymentStatus = 'PAID'
        paidAt = parseDate(inv.paidDate)
        statusNote = `bezahlt am ${inv.paidDate}`
      } else if (inv.status === 'CANCELLED') {
        lifecycleStatus = 'CANCELLED_ORIGINAL'
        statusNote = `storniert am ${inv.paidDate}`
      } else if (inv.status === 'PENDING') {
        statusNote = 'offen'
      } else {
        // Fallback, falls Finanzexport-Datei im Export fehlte: alte Heuristik + Warnhinweis
        paymentStatus = inv.paidDate ? 'PAID' : 'UNPAID'
        if (paymentStatus === 'PAID') paidAt = parseDate(inv.paidDate)
        statusNote = (paymentStatus === 'PAID' ? `bezahlt am ${inv.paidDate}` : 'offen') + ' (ungeprüft — Finanzexport fehlte)'
        result.warnings.push(`Rechnung ${inv.invoiceNr}: Zahlungsstatus nicht verifizierbar (Finanzexport-Datei fehlte im Export) — als "${paymentStatus}" markiert, bitte manuell prüfen.`)
      }

      // Psychotherapie ist umsatzsteuerbefreit (§ 6 Abs. 1 Z 19 UStG)
      const tx = await prisma.transaction.create({
        data: {
          patientId,
          createdByUserId: userId,
          direction: 'INCOME',
          sourceType: 'MANUAL',
          referenceNumber: inv.invoiceNr,
          transactionDate: invoiceDate,
          payerName,
          payeeName: praxisName,
          amountNet: inv.amount,
          vatRate: 0,
          vatAmount: 0,
          amountGross: inv.amount,
          category: 'HONORAR',
          paymentStatus,
          paidAt,
          paymentMethod: paymentStatus === 'PAID' ? 'UNBAR_BANK_TRANSFER' : null,
          lifecycleStatus,
          notes: `Importiert aus TheraPsy: ${inv.invoiceNr} (${statusNote})`,
        },
      })

      const lineItem = await prisma.txLineItem.create({
        data: {
          transactionId: tx.id,
          description: 'Einzeltherapie (importiert aus TheraPsy)',
          quantity: 1,
          unitPriceNet: inv.amount,
          amountNet: inv.amount,
          vatRate: 0,
          vatAmount: 0,
          amountGross: inv.amount,
          lineDate: invoiceDate,
        },
      })

      // Sitzungs-Zuordnung über die im Finanzexport genannten Sitzungsnamen
      if (patientId && inv.sessionNames && inv.sessionNames.length > 0) {
        const foundSessionIds = inv.sessionNames
          .map(name => sessionIdByPatientAndName.get(`${patientId}::${name}`))
          .filter((x): x is string => !!x)
        if (foundSessionIds.length > 0) {
          const share = inv.amount / foundSessionIds.length
          for (const sid of foundSessionIds) {
            await prisma.txSessionAllocation.create({
              data: {
                transactionId: tx.id,
                lineItemId: lineItem.id,
                sessionId: sid,
                allocationPercentage: 1 / foundSessionIds.length,
                allocatedAmountNet: share,
                allocatedVatAmount: 0,
                allocatedAmountGross: share,
              },
            })
          }
        }
      }

      // Original-Rechnungsdatei (xlsx) als Dokument anhängen
      if (inv.xlsxBase64) {
        await prisma.invoiceDocument.create({
          data: {
            transactionId: tx.id,
            documentType: 'INVOICE_XLSX',
            format: 'xlsx',
            data: Buffer.from(inv.xlsxBase64, 'base64'),
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        })
      }

      result.transactions++
    }
  }

  // ── 4. BMD-Buchungssätze als Transaktionen (vereinheitlicht, kein Legacy mehr) ─
  // Schreibt in `Transaction` — das alte FinanceTransaction-Modell existiert
  // nicht mehr. Dedup läuft allein über die global
  // eindeutige referenceNumber und deckt damit automatisch sowohl bereits über
  // Schritt 3 importierte Honorarnoten als auch wiederholte BMD-Läufe ab; ein
  // separater Cross-Check zwischen zwei Tabellen ist dadurch nicht mehr nötig.
  if (selectedAreas.includes('finanzexport')) {
    let bmdFallbackSeq = 0
    for (const row of bmdRows) {
      const belegDate = parseDate(row.belegdatum) ?? parseDate(row.buchdatum)
      if (!belegDate) continue

      // Belegnummer wenn vorhanden übernehmen (matcht ggf. eine TheraPsy-Rechnung
      // aus Schritt 3), sonst eine stabile Ersatznummer vergeben.
      const refNum = row.belegnr || `BMD-${belegDate.getTime()}-${bmdFallbackSeq++}`

      const existingTx = await prisma.transaction.findUnique({ where: { referenceNumber: refNum } })
      if (existingTx) continue

      const direction: 'INCOME' | 'EXPENSE' = row.typ === 'E' ? 'INCOME' : 'EXPENSE'
      const category = row.typ === 'E' ? 'HONORAR' : 'MISC_BUSINESS'
      // Vorzeichen NICHT mit Math.abs() verwerfen — Stornos/Korrekturen sind in der
      // BMD-CSV negativ codiert; sonst wird aus einer Korrektur eine zusätzliche
      // positive Buchung (siehe Diagnose vom 1.7.2026: E26023/E26025 wurden dadurch
      // von -110€ zu +110€).
      const amount = row.betrag

      const tx = await prisma.transaction.create({
        data: {
          createdByUserId: userId,
          direction,
          sourceType: 'MANUAL',
          referenceNumber: refNum,
          transactionDate: belegDate,
          payerName: direction === 'INCOME' ? (row.text || 'Unbekannt') : praxisName,
          payeeName: direction === 'INCOME' ? praxisName : (row.text || 'Unbekannt'),
          amountNet: amount,
          vatRate: 0,
          vatAmount: 0,
          amountGross: amount,
          category,
          paymentStatus: 'PAID',
          paidAt: belegDate,
          paymentMethod: 'UNBAR_BANK_TRANSFER',
          lifecycleStatus: 'ACTIVE',
          notes: row.text || `BMD-Buchung ${row.belegnr}`,
        },
      })

      await prisma.txLineItem.create({
        data: {
          transactionId: tx.id,
          description: row.text || `BMD-Buchung ${row.belegnr}`,
          quantity: 1,
          unitPriceNet: amount,
          amountNet: amount,
          vatRate: 0,
          vatAmount: 0,
          amountGross: amount,
          lineDate: belegDate,
        },
      })

      result.transactions++
    }
  }

  return result
}
