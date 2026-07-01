import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAvatarSvg, generateGroupAvatarSvg } from '@/lib/avatarSettings'

// GET /api/avatar?seed=xyz&bg=e3e3e3            → eine Person
// GET /api/avatar?seeds=a,b,c&bg=e3e3e3          → mehrere Personen kombiniert (Paar/Familie/Gruppe)
// Rendert einen DiceBear-Avataaars-Avatar als SVG. Der Seed bestimmt Frisur,
// Hautfarbe, Kleidung etc. — enthält keinerlei Patientendaten, ist nur ein
// von Admins gewählter Darstellungs-Code je Gruppe (siehe /api/settings/avatars).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const seed = searchParams.get('seed')
  const seedsRaw = searchParams.get('seeds')
  const bg = searchParams.get('bg') ?? undefined

  try {
    let svg: string
    if (seedsRaw) {
      const seeds = seedsRaw.split(',').map(s => s.trim()).filter(Boolean)
      if (seeds.length === 0) return NextResponse.json({ error: 'seeds ist leer' }, { status: 400 })
      svg = await generateGroupAvatarSvg(seeds, bg)
    } else if (seed) {
      svg = await generateAvatarSvg(seed, bg)
    } else {
      return NextResponse.json({ error: 'seed oder seeds fehlt' }, { status: 400 })
    }
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
