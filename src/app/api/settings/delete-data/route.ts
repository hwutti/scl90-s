import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/settings/delete-data
// body: { scope: 'all' | 'finance', confirmPhrase: string }
// confirmPhrase muss exakt "ALLE DATEN LÖSCHEN" oder "FINANZDATEN LÖSCHEN" sein
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'ADMIN')
    return NextResponse.json({ error: 'Nur Administratoren können Daten löschen' }, { status: 403 })

  const body = await req.json()
  const { scope, confirmPhrase } = body

  const REQUIRED_ALL     = 'ALLE DATEN LÖSCHEN'
  const REQUIRED_FINANCE = 'FINANZDATEN LÖSCHEN'

  if (scope === 'all' && confirmPhrase !== REQUIRED_ALL) {
    return NextResponse.json(
      { error: `Sicherheitsphrase falsch. Bitte genau "${REQUIRED_ALL}" eingeben.` },
      { status: 400 }
    )
  }
  if (scope === 'finance' && confirmPhrase !== REQUIRED_FINANCE) {
    return NextResponse.json(
      { error: `Sicherheitsphrase falsch. Bitte genau "${REQUIRED_FINANCE}" eingeben.` },
      { status: 400 }
    )
  }

  // AuditLog VOR der Löschung
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DATA_DELETED',
      details: { scope, initiatedAt: new Date().toISOString() },
    },
  })

  if (scope === 'finance') {
    // Nur Finanzdaten löschen — Profile und Sessions bleiben
    await prisma.$transaction([
      prisma.transactionReceipt.deleteMany({}),
      prisma.txSessionAllocation.deleteMany({}),
      prisma.txLineItem.deleteMany({}),
      prisma.invoiceDocument.deleteMany({}),
      prisma.transaction.deleteMany({}),
      prisma.referenceNumberLedger.deleteMany({}),
      prisma.mileageLog.deleteMany({}),
      prisma.travelLogEntry.deleteMany({}),
    ])
    return NextResponse.json({ ok: true, scope: 'finance', deletedAt: new Date().toISOString() })
  }

  if (scope === 'all') {
    // Alles löschen außer User und PraxisConfig
    await prisma.$transaction([
      prisma.auditLog.deleteMany({}),
      prisma.transactionReceipt.deleteMany({}),
      prisma.txSessionAllocation.deleteMany({}),
      prisma.txLineItem.deleteMany({}),
      prisma.invoiceDocument.deleteMany({}),
      prisma.transaction.deleteMany({}),
      prisma.referenceNumberLedger.deleteMany({}),
      prisma.mileageLog.deleteMany({}),
      prisma.travelLogEntry.deleteMany({}),
      prisma.sessionAssessmentValue.deleteMany({}),
      prisma.sessionServiceLine.deleteMany({}),
      prisma.supervisionSessionLink.deleteMany({}),
      prisma.supervisionEntry.deleteMany({}),
      prisma.audioRecording.deleteMany({}),
      prisma.sessionAttachment.deleteMany({}),
      prisma.sessionProtocolSection.deleteMany({}),
      prisma.sessionProtocol.deleteMany({}),
      prisma.sessionAssessmentLink.deleteMany({}),
      prisma.therapySession.deleteMany({}),
      prisma.profileTimelineEvent.deleteMany({}),
      prisma.patientDocument.deleteMany({}),
      prisma.patientDiagnosis.deleteMany({}),
      prisma.medication.deleteMany({}),
      prisma.contingentAccount.deleteMany({}),
      prisma.therapyGoal.deleteMany({}),
      prisma.anamnesisSection.deleteMany({}),
      prisma.anamnesis.deleteMany({}),
      prisma.sessionNote.deleteMany({}),
      prisma.answer.deleteMany({}),
      prisma.assessmentResult.deleteMany({}),
      prisma.assessment.deleteMany({}),
      prisma.sessionRating.deleteMany({}),
      prisma.patientPhoto.deleteMany({}),
      prisma.therapistPatient.deleteMany({}),
      prisma.patient.deleteMany({}),
    ])
    return NextResponse.json({ ok: true, scope: 'all', deletedAt: new Date().toISOString() })
  }

  return NextResponse.json({ error: 'Ungültiger scope' }, { status: 400 })
}
