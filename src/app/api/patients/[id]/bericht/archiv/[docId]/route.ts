import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Liefert den exakt eingefrorenen HTML-Inhalt zum Anzeigen/Drucken.
// Wird NIE neu gerendert - reiner Lesezugriff auf das Archiv.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const doc = await prisma.patientReportDocument.findFirst({
    where: { id: params.docId, patientId: params.id, deletedAt: null },
  })
  if (!doc || !doc.data) return new NextResponse('Not found', { status: 404 })

  const body = doc.data.toString('utf8')
  const printHtml = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<title>Bericht ${doc.reportType}</title>
<style>
  @media print { @page { margin: 0; size: A4; } .no-print { display: none !important; } }
  body { margin: 0; }
</style>
</head><body>
<div class="no-print" style="position:fixed;top:12px;right:12px;z-index:9999;display:flex;gap:8px">
  <button onclick="window.print()" style="padding:8px 18px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:sans-serif">
    🖨 Drucken / Als PDF speichern
  </button>
  <button onclick="window.close()" style="padding:8px 14px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:sans-serif">
    ✕ Schließen
  </button>
</div>
${body}
</body></html>`

  return new NextResponse(printHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const doc = await prisma.patientReportDocument.findFirst({
    where: { id: params.docId, patientId: params.id, deletedAt: null },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.patientReportDocument.update({
    where: { id: doc.id },
    data: { deletedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
