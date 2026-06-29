import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, active: true, avatarBase64: true, avatarMime: true,
      createdAt: true, updatedAt: true,
      _count: {
        select: {
          createdPatients: true,
          therapistPatients: true,
          therapySessions: true,
          createdAssessments: true,
        }
      }
    }
  })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const body = await req.json()
  const { name, email, currentPassword, newPassword, avatarBase64, avatarMime, removeAvatar } = body

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })

  const data: any = {}

  if (name?.trim()) data.name = name.trim()
  if (email?.trim() && email !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (exists) return NextResponse.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' }, { status: 400 })
    data.email = email.trim()
  }

  if (removeAvatar) {
    data.avatarBase64 = null
    data.avatarMime   = null
  } else if (avatarBase64) {
    data.avatarBase64 = avatarBase64
    data.avatarMime   = avatarMime ?? 'image/jpeg'
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Aktuelles Passwort fehlt.' }, { status: 400 })
    if (newPassword.length < 8) return NextResponse.json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 })
    const ok = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash) : false
    if (!ok) return NextResponse.json({ error: 'Aktuelles Passwort ist falsch.' }, { status: 400 })
    data.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Keine Änderungen.' }, { status: 400 })

  const updated = await prisma.user.update({ where: { id: userId }, data })
  return NextResponse.json({ ok: true, name: updated.name, email: updated.email })
}
