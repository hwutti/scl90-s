import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAvatarSvg } from '@/lib/avatarSettings'

// GET /api/avatar?seed=xyz&bg=e3e3e3
// Rendert einen DiceBear-Avataaars-Avatar als SVG. Der Seed bestimmt Frisur,
// Hautfarbe, Kleidung etc. — enthält keinerlei Patientendaten, ist nur ein
// von Admins gewählter Darstellungs-Code je Gruppe (siehe /api/settings/avatars).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const seed = searchParams.get('seed')
  const bg = searchParams.get('bg') ?? undefined
  if (!seed) return NextResponse.json({ error: 'seed fehlt' }, { status: 400 })

  try {
    const svg = await generateAvatarSvg(seed, bg)
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
