import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTestMail } from '@/lib/email/mailer'

// GET: aktuelle SMTP-Konfiguration laden
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const config = await prisma.smtpConfig.findFirst({ where: { isActive: true } })
  if (!config) return NextResponse.json(null)
  // Passwort nie zurückschicken
  const { password, ...safe } = config
  return NextResponse.json({ ...safe, passwordSet: !!password })
}

// PUT: SMTP-Konfiguration speichern
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { provider, host, port, secure, user, password, fromName, fromEmail, replyTo } = body

  if (!host || !user || !fromEmail) {
    return NextResponse.json({ error: 'Host, Benutzer und Absender-E-Mail sind Pflichtfelder.' }, { status: 400 })
  }

  const existing = await prisma.smtpConfig.findFirst({ where: { isActive: true } })

  const data: any = {
    provider: provider ?? 'custom',
    host, port: parseInt(port) || 587,
    secure: Boolean(secure),
    user, fromName: fromName || 'KDS Praxis',
    fromEmail, replyTo: replyTo || null,
    isActive: true,
  }
  // Passwort nur updaten wenn neu angegeben
  if (password) data.password = password

  let config
  if (existing) {
    config = await prisma.smtpConfig.update({ where: { id: existing.id }, data })
  } else {
    if (!password) return NextResponse.json({ error: 'Passwort ist beim ersten Einrichten Pflicht.' }, { status: 400 })
    config = await prisma.smtpConfig.create({ data })
  }

  const { password: _pw, ...safe } = config
  return NextResponse.json({ ...safe, passwordSet: true })
}

// POST: Testmail senden
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { testEmail } = await req.json()
  if (!testEmail) return NextResponse.json({ error: 'Empfänger-E-Mail fehlt.' }, { status: 400 })

  const result = await sendTestMail(testEmail)

  // lastTested updaten
  const existing = await prisma.smtpConfig.findFirst({ where: { isActive: true } })
  if (existing) {
    await prisma.smtpConfig.update({
      where: { id: existing.id },
      data: { lastTestedAt: new Date(), lastTestOk: result.ok },
    })
  }

  if (result.ok) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
}
