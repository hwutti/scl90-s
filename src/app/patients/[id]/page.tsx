import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { PatientRecordClient } from './PatientRecordClient'

export default async function PatientPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) redirect('/my')

  // Zugriffsprüfung
  if (role === 'THERAPIST') {
    const rel = await prisma.therapistPatient.findUnique({
      where: { therapistId_patientId: { therapistId: userId, patientId: params.id } },
    })
    if (!rel) redirect('/patients')
  }

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      therapists: { include: { therapist: { select: { id: true, name: true, email: true } } } },
      record: true,
      patientUser: { select: { id: true, pin: true, active: true } },
      assessments: {
        include: {
          result: true,
          instrument: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!patient) notFound()

  const notes = await prisma.sessionNote.findMany({
    where: { patientId: params.id, deletedAt: null },
    include: { author: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })

  const instruments = await prisma.instrument.findMany({ where: { isActive: true } })
  const invoiceTemplates = await prisma.invoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'PATIENT_VIEWED' },
  }).catch(() => {})

  return (
    <PageShell>
      <Suspense fallback={null}>
        <PatientRecordClient
          patient={patient as any}
          notes={notes as any}
          instruments={instruments}
          invoiceTemplates={invoiceTemplates as any}
          currentUserId={userId}
          role={role}
        />
      </Suspense>
    </PageShell>
  )
}
