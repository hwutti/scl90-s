import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseTherapsyRar } from '@/lib/migration/therapsy'

export const runtime = 'nodejs'
// Grosse RAR-Datei (bis 50MB) erlauben
export const maxDuration = 120

// POST /api/admin/migration/upload
// Body: FormData mit Field "file" (.rar)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Nur Admins dürfen die Migration durchführen.' }, { status: 403 })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Ungültiger Request – kein FormData.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })

  const filename = file.name.toLowerCase()
  if (!filename.endsWith('.rar')) {
    return NextResponse.json({ error: 'Nur .rar-Dateien werden akzeptiert (TheraPsy-Export).' }, { status: 400 })
  }

  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei zu groß (max. 100 MB).' }, { status: 413 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const preview = await parseTherapsyRar(buffer)
    return NextResponse.json(preview)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Fehler beim Parsen des Exports.' }, { status: 500 })
  }
}
