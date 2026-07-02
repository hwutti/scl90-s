import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffSession } from '@/lib/access'

const DEFAULT_TEMPLATE = [
  { title: 'Somatische Anamnese',           prefilledText: '' },
  { title: 'Psychische Anamnese',            prefilledText: '' },
  { title: 'Sozialanamnese',                 prefilledText: '' },
  { title: 'Biographie und Lebenssituation', prefilledText: '' },
]

// Vorlage wird in PraxisConfig als JSON gespeichert
const KEY = 'anamnesis_template'

export async function GET(_: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error

  const config = await prisma.praxisConfig.findFirst({ where: { key: KEY } })
  if (!config?.anamnesisTemplate) return NextResponse.json(DEFAULT_TEMPLATE)

  try {
    return NextResponse.json(JSON.parse(config.anamnesisTemplate as string))
  } catch {
    return NextResponse.json(DEFAULT_TEMPLATE)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error
  const body = await req.json()
  const fields = body.fields ?? []

  await prisma.praxisConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, praxisName: 'Anamnese-Vorlage', anamnesisTemplate: JSON.stringify(fields) },
    update: { anamnesisTemplate: JSON.stringify(fields) },
  })

  return NextResponse.json({ ok: true, fields })
}
