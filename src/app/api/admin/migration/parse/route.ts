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
    // Datei aus multipart/form-data lesen
    // Für große Dateien: Body manuell streamen statt req.formData() zu nutzen,
    // da Next.js App Router Route Handlers einen internen 4MB-Limit auf formData() haben.
    let buffer: Buffer

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      // Boundary aus Content-Type extrahieren
      const boundary = contentType.split('boundary=')[1]?.trim()
      if (!boundary) {
        return NextResponse.json({ error: 'Ungültiger Content-Type — Boundary fehlt.' }, { status: 400 })
      }

      // Body als Buffer einlesen
      const bodyBuffer = Buffer.from(await req.arrayBuffer())

      // Einfacher Multipart-Parser: Datei-Part zwischen den Boundaries suchen
      const boundaryBuf = Buffer.from('--' + boundary)
      const parts: Buffer[] = []
      let pos = 0
      while (pos < bodyBuffer.length) {
        const bStart = bodyBuffer.indexOf(boundaryBuf, pos)
        if (bStart === -1) break
        const headerEnd = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), bStart)
        if (headerEnd === -1) break
        const nextBoundary = bodyBuffer.indexOf(boundaryBuf, headerEnd + 4)
        const dataEnd = nextBoundary === -1 ? bodyBuffer.length : nextBoundary - 2 // strip \r\n
        const partData = bodyBuffer.slice(headerEnd + 4, dataEnd)
        const headerStr = bodyBuffer.slice(bStart, headerEnd).toString()
        if (headerStr.includes('filename=') && partData.length > 0) {
          parts.push(partData)
        }
        pos = nextBoundary === -1 ? bodyBuffer.length : nextBoundary
      }

      if (parts.length === 0) {
        return NextResponse.json({ error: 'Keine Datei im Upload gefunden.' }, { status: 400 })
      }
      buffer = parts[0]
    } else {
      return NextResponse.json({ error: 'Bitte als multipart/form-data hochladen.' }, { status: 400 })
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Hochgeladene Datei ist leer.' }, { status: 400 })
    }

    const hash = await sha256(buffer)

    // Prüfen ob diese Datei schon importiert wurde
    const existingRun = await prisma.migrationRun.findUnique({ where: { sourceHash: hash } })

    // Temp-Verzeichnis anlegen und Datei speichern
    tmpDir = `/tmp/kds-migration-${Date.now()}`
    fs.mkdirSync(tmpDir, { recursive: true })

    // Datei-Typ anhand Magic Bytes erkennen (RAR: 52 61 72 21, ZIP: 50 4B)
    const isRar = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72
    const ext = isRar ? 'rar' : 'zip'
    const archivePath = path.join(tmpDir, `export.${ext}`)
    fs.writeFileSync(archivePath, buffer)

    // Entpacken
    if (ext === 'rar') {
      try {
        execSync(`unrar x -y "${archivePath}" "${tmpDir}/" 2>&1`, { timeout: 60000 })
      } catch {
        return NextResponse.json({
          error: 'RAR-Extraktion fehlgeschlagen. Bitte sicherstellen dass "unrar" installiert ist (sudo apt install unrar) und erneut versuchen.',
        }, { status: 422 })
      }
    } else {
      try {
        execSync(`unzip -o "${archivePath}" -d "${tmpDir}/" 2>&1`, { timeout: 60000 })
      } catch {
        return NextResponse.json({ error: 'ZIP-Extraktion fehlgeschlagen.' }, { status: 422 })
      }
    }

    // Export-Unterverzeichnis finden
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
    if (tmpDir) try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    console.error('Migration parse error:', err)
    return NextResponse.json({ error: err?.message ?? 'Unbekannter Fehler beim Parsen.' }, { status: 500 })
  }
}
