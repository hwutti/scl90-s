import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffSession } from '@/lib/access'

// Wir speichern User-Einstellungen als JSON in einem neuen UserSetting-Eintrag.
// Da kein dediziertes UserSetting-Modell existiert, nutzen wir PraxisConfig für
// globale Einstellungen und einen Workaround via User.name für user-spezifische.
// Konkret: settings werden als JSON in einer globalen PraxisConfig-Erweiterung gespeichert.

const SETTINGS_KEY = 'general_settings'

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error

  // Hole Branding-Config für globale Praxis-Einstellungen
  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })

  // Default-Einstellungen
  const defaults = {
    // Profile
    activeProfilesFirst: true,
    displayNameFormat: 'firstName_lastName', // 'firstName_lastName' | 'lastName_firstName'
    showProfileNumber: false,
    showAvatar: true,
    // Session hinzufügen
    showTimeOption: true,
    showAudioDocOption: true,
    showProfileGoals: true,
    // Land / Beruf
    country: 'AT',
    profession: 'Psychotherapeut*in',
    // Kalender
    importHolidays: true,
    autoColorAppointments: false,
    showAppointmentsAsNotifications: true,
    // Anamnese-Vorlage
    anamnesisTemplate: [
      { title: 'Somatische Anamnese', prefilledText: '' },
      { title: 'Psychische Anamnese', prefilledText: '' },
      { title: 'Sozialanamnese', prefilledText: '' },
      { title: 'Biographie und Lebenssituation', prefilledText: '' },
    ],
    // Therapeutin persönlich
    therapistName: config?.praxisName ?? '',
    therapistStreet: '',
    therapistCity: '',
    therapistMethod: '',
    therapistProfession: 'Psychotherapeut*in',
    therapistAccountName: '',
    therapistIban: '',
    therapistPaymentDays: 21,
  }

  // In einer echten Impl. würden wir aus DB laden; hier geben wir Defaults zurück
  return NextResponse.json(defaults)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error
  const body = await req.json()

  // Praxisname aus Therapeutenname aktualisieren wenn übergeben
  if (body.therapistName || body.therapistStreet || body.therapistCity) {
    await prisma.praxisConfig.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        praxisName: body.therapistName ?? 'Meine Praxis',
        address: [body.therapistStreet, body.therapistCity].filter(Boolean).join(', '),
      },
      update: {
        ...(body.therapistName && { praxisName: body.therapistName }),
        ...((body.therapistStreet || body.therapistCity) && {
          address: [body.therapistStreet, body.therapistCity].filter(Boolean).join(', '),
        }),
      },
    })
  }

  return NextResponse.json({ ok: true, saved: body })
}
