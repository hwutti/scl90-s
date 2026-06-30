import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  renderConfirmation, resolveTextPlaceholders, getDefaultConfirmationTemplate,
  buildConfirmationPlaceholders,
} from '@/lib/confirmation/template'
import { getBranding } from '@/lib/branding'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; confirmationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const confirmation = await prisma.confirmation.findFirst({
    where: { id: params.confirmationId, patientId: params.id, deletedAt: null },
  })
  if (!confirmation) return new NextResponse('Not found', { status: 404 })

  // Einmal ausgestellt, bleibt der Inhalt unveränderlich - unabhängig von
  // späteren Branding-/Vorlagen-Änderungen (gleiches Prinzip wie bei
  // Rechnungen und Berichten).
  let body: string
  const existing = await prisma.confirmationDocument.findFirst({
    where: { confirmationId: confirmation.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  if (existing?.data) {
    body = existing.data.toString('utf8')
  } else {
    body = await renderFreshConfirmationHtml(confirmation)
    await prisma.confirmationDocument.create({
      data: { confirmationId: confirmation.id, data: Buffer.from(body, 'utf8'), mimeType: 'text/html' },
    })
    if (confirmation.status !== 'AUSGESTELLT') {
      await prisma.confirmation.update({ where: { id: confirmation.id }, data: { status: 'AUSGESTELLT' } })
    }
  }

  const printHtml = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<title>${confirmation.titel}</title>
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

// Setzt das eingefrorene Dokument zurück, damit beim nächsten Anzeigen/Drucken
// wieder frisch (mit den aktuellen, evtl. bearbeiteten Daten) gerendert wird.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; confirmationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const confirmation = await prisma.confirmation.findFirst({
    where: { id: params.confirmationId, patientId: params.id, deletedAt: null },
  })
  if (!confirmation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.confirmationDocument.updateMany({
    where: { confirmationId: confirmation.id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  await prisma.confirmation.update({ where: { id: confirmation.id }, data: { status: 'ENTWURF' } })

  return NextResponse.json({ ok: true })
}

async function renderFreshConfirmationHtml(confirmation: any): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { id: confirmation.patientId } })
  if (!patient) throw new Error('Patient nicht gefunden')

  const therapySession = confirmation.sessionId
    ? await prisma.therapySession.findUnique({ where: { id: confirmation.sessionId } })
    : null

  const creator = await prisma.user.findUnique({ where: { id: confirmation.createdByUserId } })
  const branding = await getBranding()
  const { html: templateHtml, guiFields } = await getDefaultConfirmationTemplate(confirmation.templateId)

  const placeholders = buildConfirmationPlaceholders({
    patient: {
      firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob,
      billRecipientAddress: patient.billRecipientAddress, billRecipientCity: patient.billRecipientCity,
    },
    therapistName: creator?.name ?? '',
    praxisName: guiFields?.praxisName || branding.praxisName || '',
    praxisAddress: guiFields?.praxisAddress || branding.address || '',
    praxisEmail: guiFields?.praxisEmail || branding.contactEmail || '',
    praxisPhone: guiFields?.praxisPhone || branding.contactPhone || '',
    session: therapySession ? { sessionDate: therapySession.sessionDate, durationMinutes: therapySession.durationMinutes } : null,
    titel: confirmation.titel,
  })

  const freitext = resolveTextPlaceholders(confirmation.inhalt ?? '', placeholders)

  const bgOpacity = ((guiFields?.bgImageOpacity ?? 0.06) as number).toFixed(2)
  const bgMode = guiFields?.bgImageMode ?? 'behind'

  const data: Record<string, any> = {
    praxis_name: placeholders.praxis,
    praxis_address: placeholders.praxis_adresse,
    praxis_email: placeholders.email,
    praxis_phone: placeholders.telefon,
    primary_color: guiFields?.primaryColor || branding.colorPrimary || '#4f46e5',
    font_family: guiFields?.fontFamily || 'Helvetica Neue, Arial, sans-serif',
    font_size: guiFields?.fontSize || '11pt',
    tax_number: guiFields?.taxNumber || '',
    vat_id: guiFields?.vatId || '',
    footer_text: guiFields?.footerText || '',
    header_image_base64: guiFields?.headerImageBase64 || '',
    header_image_mime: guiFields?.headerImageMime || 'image/png',
    footer_image_base64: guiFields?.footerImageBase64 || '',
    footer_image_mime: guiFields?.footerImageMime || 'image/png',
    bg_image_base64: guiFields?.bgImageBase64 || '',
    bg_image_mime: guiFields?.bgImageMime || 'image/png',
    bg_image_opacity: bgOpacity,
    bg_is_watermark: bgMode === 'watermark',
    signature_image_base64: guiFields?.signatureImageBase64 ?? '',
    signature_image_mime:   guiFields?.signatureImageMime   ?? 'image/png',
    heutiges_datum: placeholders.heutiges_datum,
    titel: placeholders.titel,
    therapeut_name: placeholders.therapeut_name,
    freitext,
  }

  return renderConfirmation(templateHtml, data)
}
