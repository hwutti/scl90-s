import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seed: Admin-User und Demo-Daten anlegen…')

  // Admin anlegen
  const adminHash = await bcrypt.hash('Admin1234!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@scl90s.local' },
    update: {},
    create: {
      email: 'admin@scl90s.local',
      name: 'Administrator',
      role: 'ADMIN',
      passwordHash: adminHash,
    },
  })
  console.log('✓ Admin:', admin.email, '/ Passwort: Admin1234!')

  // Demo-Therapeut
  const therapistHash = await bcrypt.hash('Therapeut1234!', 12)
  const therapist = await prisma.user.upsert({
    where: { email: 'therapeut@scl90s.local' },
    update: {},
    create: {
      email: 'therapeut@scl90s.local',
      name: 'Dr. Maria Muster',
      role: 'THERAPIST',
      passwordHash: therapistHash,
    },
  })
  console.log('✓ Therapeut:', therapist.email, '/ Passwort: Therapeut1234!')

  // Demo-Patient mit PIN
  const patient = await prisma.user.upsert({
    where: { pin: '123456' },
    update: {},
    create: {
      name: 'Max Mustermann',
      role: 'PATIENT',
      pin: '123456',
      therapistId: therapist.id,
    },
  })
  console.log('✓ Patient:', patient.name, '/ PIN: 123456')

  console.log('\nSeed abgeschlossen. Bitte Passwörter in der Produktion ändern!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
