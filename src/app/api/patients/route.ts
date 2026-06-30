import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPracticeConfig } from '@/lib/access'
import { generatePin } from '@/lib/utils'
import { Gender } from '@prisma/client'

// GET /api/patients – Liste aller Patienten des Therapeuten
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Praxis-Modus: Zugriffsrechte prüfen
  const { mode, perms } = await getPracticeConfig()

  let where: any
  if (role === 'ADMIN') {
    if (mode === 'group' && !perms.seePatients) {
      return NextResponse.json([]) // Admin in Gruppenpraxis ohne Berechtigung
    }
    where = { deletedAt: null }
  } else {
    // Therapeut: eigene Patienten + freigegebene
    const shares = await prisma.patientShare.findMany({
      where: { sharedWithId: userId },
      select: { patientId: true },
    })
    if (shares.length > 0) {
      where = {
        deletedAt: null,
        OR: [
          { therapists: { some: { therapistId: userId } } },
          { id: { in: shares.map((s: any) => s.patientId) } },
        ],
      }
    } else {
      where = { deletedAt: null, therapists: { some: { therapistId: userId } } }
    }
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      therapists: { include: { therapist: { select: { id: true, name: true } } } },
      assessments: {
        include: { result: true, instrument: { select: { code: true, shortName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      patientUser: { select: { id: true, pin: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return NextResponse.json(patients)
}

// POST /api/patients – Neuen Patienten anlegen
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { firstName, lastName, dob, gender, svnr, phone, email,
          insuranceProvider, referralSource, createLogin,
          defaultBillingMode, defaultUnitDuration, defaultUnitPriceNet,
          sessionStartNumber } = body

  if (!firstName || !lastName || !dob || !gender) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  // Optionalen PIN-Login-User erstellen
  let patientUserId: string | undefined
  let pin: string | undefined

  if (createLogin) {
    pin = generatePin()
    while (await prisma.user.findUnique({ where: { pin } })) pin = generatePin()
    const patientUser = await prisma.user.create({
      data: { name: `${firstName} ${lastName}`, role: 'PATIENT', pin },
    })
    patientUserId = patientUser.id
  }

  const patientCount = await prisma.patient.count()
  const codeName = 'KL-' + String(patientCount + 1).padStart(3, '0')

  const patient = await prisma.patient.create({
    data: {
      firstName, lastName, dob,
      codeName,
      gender: gender as Gender,
      svnr: svnr || null,
      phone: phone || null,
      email: email || null,
      insuranceProvider: insuranceProvider || null,
      referralSource: referralSource || null,
      defaultBillingMode: defaultBillingMode || 'time',
      defaultUnitDuration: defaultUnitDuration ? parseInt(defaultUnitDuration) : 50,
      defaultUnitPriceNet: defaultUnitPriceNet ? parseFloat(defaultUnitPriceNet) : null,
      sessionStartNumber: sessionStartNumber ? parseInt(sessionStartNumber) : 0,
      createdByUserId: userId,
      patientUserId: patientUserId,
      therapists: { create: { therapistId: userId, isPrimary: true } },
      record: { create: { updatedByUserId: userId } },
    },
    include: { patientUser: { select: { pin: true } } },
  })

  await prisma.auditLog.create({
    data: { userId, patientId: patient.id, action: 'PATIENT_CREATED',
            details: { firstName, lastName } },
  }).catch(() => {})

  // Leere Anamnese nach Vorlage anlegen (KDS-SCR-18)
  try {
    const config = await prisma.praxisConfig.findFirst({ where: { key: 'anamnesis_template' } })
    const fields = config?.anamnesisTemplate
      ? JSON.parse(config.anamnesisTemplate as string)
      : [
          { title: 'Somatische Anamnese', prefilledText: '' },
          { title: 'Psychische Anamnese', prefilledText: '' },
          { title: 'Sozialanamnese', prefilledText: '' },
          { title: 'Biographie und Lebenssituation', prefilledText: '' },
        ]

    await prisma.anamnesis.create({
      data: {
        patientId: patient.id,
        sections: {
          create: fields.map((f: any, i: number) => ({
            title: f.title,
            content: f.prefilledText || '',
            sortOrder: i,
          })),
        },
      },
    })
  } catch (_) {}

  // Timeline-Event: Profil erstellt
  try {
    await prisma.profileTimelineEvent.create({
      data: {
        patientId: patient.id,
        eventType: 'profile_created',
        relatedEntityType: 'patient',
        relatedEntityId: patient.id,
        title: `Profil: ${firstName} ${lastName} erstellt`,
        eventDate: new Date(),
        createdByUserId: userId,
      },
    })
  } catch (_) {}

  return NextResponse.json({ ...patient, generatedPin: pin })
}
