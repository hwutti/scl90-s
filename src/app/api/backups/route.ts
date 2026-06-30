import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/var/backups/kds'

// POST /api/backups/create
// Erstellt einen pg_dump-Backup als SQL-Datei
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'THERAPIST')
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const userId = (session.user as any).id

  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `kds-backup-${ts}.sql`
    const filepath = path.join(BACKUP_DIR, filename)

    // pg_dump via DATABASE_URL
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) throw new Error('DATABASE_URL nicht konfiguriert')

    execSync(`pg_dump "${dbUrl}" -f "${filepath}" --no-password 2>&1`, { timeout: 60000 })

    // AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BACKUP_CREATED',
        details: { action: 'backup_created', filename, path: filepath },
      },
    })

    return NextResponse.json({
      ok: true,
      filename,
      path: filepath,
      createdAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Backup fehlgeschlagen' }, { status: 500 })
  }
}
