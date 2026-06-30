import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeMigration } from '@/lib/migration/therapsyExecutor'

export const maxDuration = 120

// POST /api/admin/migration/execute
// Body: { sourceHash, selectedAreas, patients, sessions, invoices, bmdRows }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur Admins dürfen Migrationen durchführen.' }, { status: 403 })
  }
  const userId = (session.user as any).id

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 })
  }

  const { sourceHash, selectedAreas, patients, sessions, invoices, bmdRows } = body
  if (!sourceHash || !selectedAreas) {
    return NextResponse.json({ error: 'sourceHash und selectedAreas sind erforderlich.' }, { status: 400 })
  }

  try {
    const result = await executeMigration(
      patients ?? [], sessions ?? [], invoices ?? [], bmdRows ?? [],
      { userId, selectedAreas, importProfiles: true, importSessions: true, importInvoices: true, importBmd: true, importSupervision: true },
    )

    // MigrationRun protokollieren (upsert damit zweiter Lauf die Stats aktualisiert)
    await prisma.migrationRun.upsert({
      where: { sourceHash },
      create: {
        sourceHash, runBy: userId, stats: JSON.stringify(result),
        warnings: result.warnings.length > 0 ? JSON.stringify(result.warnings) : null,
      },
      update: {
        runBy: userId, ranAt: new Date(), stats: JSON.stringify(result),
        warnings: result.warnings.length > 0 ? JSON.stringify(result.warnings) : null,
      },
    })

    await prisma.auditLog.create({
      data: { userId, action: 'MIGRATION_IMPORT', details: { sourceApp: 'TheraPsy', result } as any },
    }).catch(() => {})

    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    console.error('Migration execute error:', err)
    return NextResponse.json({ error: err?.message ?? 'Fehler beim Ausführen der Migration.' }, { status: 500 })
  }
}
