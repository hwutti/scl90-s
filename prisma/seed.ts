import { PrismaClient, Gender, AssessmentStatus, NoteType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seed: Basisdaten anlegen…')

  // ─── Admin ────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin1234!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kds.local' },
    update: {},
    create: {
      email: 'admin@kds.local',
      name: 'Administrator',
      role: 'ADMIN',
      passwordHash: adminHash,
    },
  })
  console.log('✓ Admin:', admin.email)

  // ─── Demo-Therapeut ────────────────────────────────────────────────────────
  const therapistHash = await bcrypt.hash('Therapeut1234!', 12)
  const therapist = await prisma.user.upsert({
    where: { email: 'therapeut@kds.local' },
    update: {},
    create: {
      email: 'therapeut@kds.local',
      name: 'Dr. Maria Muster',
      role: 'THERAPIST',
      passwordHash: therapistHash,
    },
  })
  console.log('✓ Therapeut:', therapist.email)

  // ─── SCL-90-S Instrument ──────────────────────────────────────────────────
  const kds = await prisma.instrument.upsert({
    where: { code: 'SCL90S' },
    update: {},
    create: {
      code: 'SCL90S',
      name: 'KDS – Klinisches Dokumentationssystem (SCL-90-S) 90 Standard',
      shortName: 'SCL-90-S',
      version: 'Franke 2014',
      description: 'Selbstbeurteilungsinstrument zur Erfassung der subjektiv empfundenen psychischen Belastung.',
      itemCount: 90,
    },
  })
  console.log('✓ Instrument:', kds.code)

  // ─── Demo-Patient-User (PIN-Login) ────────────────────────────────────────
  const patientUser = await prisma.user.upsert({
    where: { pin: '123456' },
    update: {},
    create: {
      name: 'Herbert Wutti',
      role: 'PATIENT',
      pin: '123456',
    },
  })

  // ─── Demo-Patient (Patientenakte) ─────────────────────────────────────────
  const existingPatient = await prisma.patient.findFirst({
    where: { patientUserId: patientUser.id }
  })

  const patient = existingPatient ?? await prisma.patient.create({
    data: {
      firstName: 'Herbert',
      lastName: 'Wutti',
      dob: '1975-11-04',
      gender: Gender.MALE,
      createdByUserId: therapist.id,
      patientUserId: patientUser.id,
      referralSource: 'Selbstzuweisung',
    },
  })
  console.log('✓ Patient:', patient.firstName, patient.lastName)

  // Therapeut-Patient-Relation
  await prisma.therapistPatient.upsert({
    where: { therapistId_patientId: { therapistId: therapist.id, patientId: patient.id } },
    update: {},
    create: { therapistId: therapist.id, patientId: patient.id, isPrimary: true },
  })

  // Patientenakte anlegen
  await prisma.patientRecord.upsert({
    where: { patientId: patient.id },
    update: {},
    create: {
      patientId: patient.id,
      chiefComplaint: 'Anhaltende psychische Belastung, Schlafstörungen, Erschöpfung.',
      therapyGoals: 'Symptomreduktion, Verbesserung der Schlafqualität, Entwicklung von Bewältigungsstrategien.',
      therapyStart: new Date('2026-01-15'),
      sessionFrequency: 'wöchentlich',
      diagnoses: JSON.stringify([
        { code: 'F41.1', label: 'Generalisierte Angststörung', date: '2026-01-15', isPrimary: true }
      ]),
      updatedByUserId: therapist.id,
    },
  })

  // Demo-Verlaufsnotiz
  const noteExists = await prisma.sessionNote.findFirst({ where: { patientId: patient.id } })
  if (!noteExists) {
    await prisma.sessionNote.create({
      data: {
        patientId: patient.id,
        authorId: therapist.id,
        date: new Date('2026-01-15'),
        noteType: NoteType.ANAMNESIS,
        content: 'Erstgespräch. Patient berichtet von anhaltenden Schlafstörungen seit ca. 6 Monaten, innerer Unruhe und Erschöpfung. Keine suizidalen Gedanken. SCL-90-S Ersterhebung vereinbart.',
      },
    })
    console.log('✓ Demo-Verlaufsnotiz angelegt')
  }

  // Demo-Assessment anlegen
  const assessExists = await prisma.assessment.findFirst({ where: { patientId: patient.id } })
  if (!assessExists) {
    await prisma.assessment.create({
      data: {
        patientId: patient.id,
        instrumentId: kds.id,
        createdByUserId: therapist.id,
        status: AssessmentStatus.ASSIGNED,
        occasion: 'Ersterhebung',
      },
    })
    console.log('✓ Demo-Assessment angelegt')
  }


  // ─── PraxisConfig (Default-Branding) ──────────────────────────────────────
  await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      praxisName: 'Psychotherapeutische Praxis',
      slogan: 'KDS – Klinisches Dokumentationssystem',
      colorPrimary: '#4f46e5',
      colorPrimaryLight: '#eef2ff',
      colorAccent: '#4338ca',
      imprintHtml: '<p>Bitte Impressum im Admin-Bereich konfigurieren.</p>',
    },
  })
  console.log('✓ PraxisConfig angelegt')


  // ─── Standard-Termintypen ──────────────────────────────────────────────────
  const appointmentTypes = [
    { name: 'Erstgespräch',        color: '#7c3aed', durationMin: 60,  description: 'Erstkontakt und Anamnese' },
    { name: 'Einzeltherapie',      color: '#4f46e5', durationMin: 50,  description: 'Reguläre Therapiestunde' },
    { name: 'Krisenintervention',  color: '#dc2626', durationMin: 60,  description: 'Akute Krisenunterstützung' },
    { name: 'Gruppentherapie',     color: '#0369a1', durationMin: 90,  description: 'Gruppentherapeutische Sitzung' },
    { name: 'Supervision',         color: '#92400e', durationMin: 60,  description: 'Fachliche Supervision', isBlocker: true },
    { name: 'Abschlussgespräch',   color: '#475569', durationMin: 50,  description: 'Therapieabschluss' },
  ]

  for (const t of appointmentTypes) {
    const exists = await prisma.appointmentType.findFirst({ where: { name: t.name } })
    if (!exists) await prisma.appointmentType.create({ data: t })
  }
  console.log('✓ Termintypen angelegt')

  // ─── Demo-Verfügbarkeit (Di–Fr 9–17 Uhr) ──────────────────────────────────
  for (const day of [1, 2, 3, 4]) {
    const exists = await prisma.availabilitySlot.findFirst({
      where: { therapistId: therapist.id, dayOfWeek: day }
    })
    if (!exists) {
      await prisma.availabilitySlot.create({
        data: { therapistId: therapist.id, dayOfWeek: day, startTime: '09:00', endTime: '17:00' }
      })
    }
  }
  console.log('✓ Verfügbarkeit angelegt')

  // ─── NotificationSettings ──────────────────────────────────────────────────
  await prisma.notificationSetting.upsert({
    where: { userId: therapist.id },
    update: {},
    create: { userId: therapist.id, emailEnabled: true, smsEnabled: false, inAppEnabled: true, reminderHours: [24, 1] }
  })
  await prisma.notificationSetting.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: { userId: patientUser.id, emailEnabled: true, smsEnabled: false, inAppEnabled: true, reminderHours: [24] }
  })
  console.log('✓ Notification-Einstellungen angelegt')

  console.log('\n✓ Seed abgeschlossen')
  console.log('  Admin:      admin@kds.local     / Admin1234!')
  console.log('  Therapeut:  therapeut@kds.local / Therapeut1234!')
  console.log('  Patient-PIN: 123456')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
