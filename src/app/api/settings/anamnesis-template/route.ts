import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_TEMPLATE = [
  { title: 'Somatische Anamnese',           prefilledText: '' },
  { title: 'Psychische Anamnese',            prefilledText: '' },
  { title: 'Sozialanamnese',                 prefilledText: '' },
  { title: 'Biographie und Lebenssituation', prefilledText: '' },
]

// Vorlage wird in PraxisConfig als JSON gespeichert
const KEY = 'anamnesis_template'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.praxisConfig.findFirst({ where: { key: KEY } })
  if (!config?.anamnesisTemplate) return NextResponse.json(DEFAULT_TEMPLATE)

  try {
    return NextResponse.json(JSON.parse(config.anamnesisTemplate as string))
  } catch {
    return NextResponse.json(DEFAULT_TEMPLATE)
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const fields = body.fields ?? []

  await prisma.praxisConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, praxisName: 'Anamnese-Vorlage', anamnesisTemplate: JSON.stringify(fields) },
    update: { anamnesisTemplate: JSON.stringify(fields) },
  })

  return NextResponse.json({ ok: true, fields })
}
