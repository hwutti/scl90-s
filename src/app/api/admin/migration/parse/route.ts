import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseTherapsyExport, sha256 } from '@/lib/migration/therapsyParser'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export const maxDuration = 120

// POST /api/admin/migration/parse
// Accepts multipart/form-data with field "file" (RAR or ZIP)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur Admins dürfen Migrationen durchführen.' }, { status: 403 })
  }

  let tmpDir: string | null = null
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Keine Datei hochgeladen.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const hash = await sha256(buffer)

    // Prüfen ob diese Datei schon importiert wurde
    const existingRun = await prisma.migrationRun.findUnique({ where: { sourceHash: hash } })
    // (Warnung, kein Abbruch — User kann nochmal importieren wenn sie wollen)

    // Temp-Verzeichnis anlegen und Datei speichern
    tmpDir = `/tmp/kds-migration-${Date.now()}`
    fs.mkdirSync(tmpDir, { recursive: true })
    const ext = file.name.toLowerCase().endsWith('.rar') ? 'rar' : 'zip'
    const archivePath = path.join(tmpDir, `export.${ext}`)
    fs.writeFileSync(archivePath, buffer)

    // Entpacken
    if (ext === 'rar') {
      try {
        execSync(`unrar x -y "${archivePath}" "${tmpDir}/" 2>&1`, { timeout: 60000 })
      } catch (e) {
        return NextResponse.json({
          error: 'RAR-Extraktion fehlgeschlagen. Bitte sicherstellen, dass "unrar" auf dem Server installiert ist (sudo apt install unrar).',
        }, { status: 422 })
      }
    } else {
      try {
        execSync(`unzip -o "${archivePath}" -d "${tmpDir}/" 2>&1`, { timeout: 60000 })
      } catch (e) {
        return NextResponse.json({ error: 'ZIP-Extraktion fehlgeschlagen.' }, { status: 422 })
      }
    }

    // Export-Unterverzeichnis finden (TheraPsy legt alles in "Export_DD.MM.YYYY/" ab)
    const entries = fs.readdirSync(tmpDir).filter(e => e !== `export.${ext}`)
    const exportSubDir = entries.find(e => fs.statSync(path.join(tmpDir!, e)).isDirectory())
    const exportDir = exportSubDir ? path.join(tmpDir, exportSubDir) : tmpDir

    // Parsen
    const preview = parseTherapsyExport(exportDir)

    // Aufräumen
    fs.rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = null

    return NextResponse.json({
      ...preview,
      sourceHash: hash,
      alreadyImported: !!existingRun,
      previousImport: existingRun ? { ranAt: existingRun.ranAt, stats: JSON.parse(existingRun.stats) } : null,
    })
  } catch (err: any) {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
    console.error('Migration parse error:', err)
    return NextResponse.json({ error: err?.message ?? 'Unbekannter Fehler beim Parsen.' }, { status: 500 })
  }
}
