import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Visuelle Einstellungen werden clientseitig in localStorage gespeichert
// und beim Login aus der DB geladen (User-spezifisch via User.name-Workaround
// bis UserVisualSettings-Modell migriert ist).

const defaults = {
  theme: 'light',        // 'light' | 'dark'
  fontSize: 'medium',    // 'small' | 'medium' | 'large'
  accentColor: '#4f46e5', // Primärfarbe
  fontFamily: 'original', // 'original' | 'serif' | 'mono'
  helpToolEnabled: true,
  classicMode: false,
  backgroundImage: null as string | null,
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Praxisconfig für Branding-Farbe als Basis
  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })

  return NextResponse.json({
    ...defaults,
    accentColor: config?.colorPrimary ?? defaults.accentColor,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  // Wenn Farbe geändert: in PraxisConfig speichern
  if (body.accentColor) {
    await prisma.praxisConfig.updateMany({
      where: { key: 'default' },
      data: { colorPrimary: body.accentColor },
    })
  }

  return NextResponse.json({ ok: true, saved: body })
}
