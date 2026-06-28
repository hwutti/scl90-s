import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Gender } from '@prisma/client'

async function canAccessPatient(userId: string, role: string, patientId: string) {
  if (role === 'ADMIN') return true
  if (role === 'THERAPIST') {
    const rel = await prisma.therapistPatient.findUnique({
      where: { therapistId_patientId: { therapistId: userId, patientId } },
    })
    return !!rel
  }
  // Patient: nur eigenes Profil
  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  return patient?.patientUserId === userId
}

// GET /api/patients/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  if (!await canAccessPatient(userId, role, params.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      therapists: { include: { therapist: { select: { id: true, name: true, email: true } } } },
      record: true,
      patientUser: { select: { id: true, pin: true, active: true } },
      assessments: {
        where: { patient: { deletedAt: null } },
        include: {
          result: true,
          instrument: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verlaufsnotizen nur für Therapeuten/Admin
  let notes = null
  if (role !== 'PATIENT') {
    notes = await prisma.sessionNote.findMany({
      where: { patientId: params.id, deletedAt: null },
      include: { author: { select: { name: true } } },
      orderBy: { date: 'desc' },
    })
  }

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'PATIENT_VIEWED' },
  }).catch(() => {})

  return NextResponse.json({ ...patient, notes })
}

// PATCH /api/patients/[id] – Stammdaten aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await canAccessPatient(userId, role, params.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { firstName, lastName, dob, gender, svnr, phone, email,
          insuranceProvider, referralSource, active,
          billRecipientName, billRecipientAddress, billRecipientCity } = body

  const patient = await prisma.patient.update({
    where: { id: params.id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName  && { lastName }),
      ...(dob       && { dob }),
      ...(gender    && { gender: gender as Gender }),
      ...(svnr      !== undefined && { svnr }),
      ...(phone     !== undefined && { phone }),
      ...(email     !== undefined && { email }),
      ...(insuranceProvider !== undefined && { insuranceProvider }),
      ...(referralSource    !== undefined && { referralSource }),
      ...(active    !== undefined && { active }),
      ...(billRecipientName    !== undefined && { billRecipientName }),
      ...(billRecipientAddress !== undefined && { billRecipientAddress }),
      ...(billRecipientCity    !== undefined && { billRecipientCity }),
    },
  })

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'PATIENT_UPDATED' },
  }).catch(() => {})

  return NextResponse.json(patient)
}

// DELETE /api/patients/[id] – Soft-Delete (Aufbewahrungspflicht!)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Nur Admins dürfen Patienten löschen' }, { status: 403 })
  const userId = (session.user as any).id

  await prisma.patient.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), active: false },
  })

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'PATIENT_DELETED',
            details: { note: 'Soft-delete, §16a 10-Jahres-Aufbewahrungspflicht' } },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
