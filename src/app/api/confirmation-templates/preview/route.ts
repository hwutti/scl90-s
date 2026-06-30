import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderConfirmation, resolveTextPlaceholders, DEFAULT_CONFIRMATION_HTML } from '@/lib/confirmation/template'
import { getBranding } from '@/lib/branding'

const MOCK_PLACEHOLDERS: Record<string, string> = {
  patient_name: 'Max Mustermann',
  patient_vorname: 'Max',
  patient_nachname: 'Mustermann',
  patient_geburtsdatum: '15.03.1985',
  patient_adresse: 'Patientengasse 7, 8010 Graz',
  therapeut_name: 'Mag. Anna Muster',
  sitzungsdatum: '29.06.2026',
  uhrzeit: '14:00',
  dauer: '50 min',
  heutiges_datum: new Date().toLocaleDateString('de-AT', { dateStyle: 'long' }),
  titel: 'Terminbestätigung',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { htmlContent, bodyText, guiFields, templateId } = body

  let resolvedHtml = htmlContent
  if (!resolvedHtml && templateId) {
    const tmpl = await prisma.confirmationTemplate.findUnique({ where: { id: templateId } })
    if (tmpl) resolvedHtml = tmpl.customHtml ? tmpl.htmlContent : DEFAULT_CONFIRMATION_HTML
  }
  if (!resolvedHtml) resolvedHtml = DEFAULT_CONFIRMATION_HTML

  const branding = await getBranding()

  const placeholders = { ...MOCK_PLACEHOLDERS }
  placeholders.praxis = guiFields?.praxisName || branding.praxisName || ''
  placeholders.praxis_adresse = guiFields?.praxisAddress || branding.address || ''
  placeholders.email = guiFields?.praxisEmail || branding.contactEmail || ''
  placeholders.telefon = guiFields?.praxisPhone || branding.contactPhone || ''

  const freitext = resolveTextPlaceholders(bodyText ?? 'Beispieltext für die Vorschau mit {{patient_name}} am {{sitzungsdatum}}.', placeholders)

  const bgOpacity = (guiFields?.bgImageOpacity ?? 0.06).toFixed(2)
  const bgMode = guiFields?.bgImageMode ?? 'behind'

  const data: Record<string, any> = {
    praxis_name: guiFields?.praxisName || branding.praxisName,
    praxis_address: guiFields?.praxisAddress || branding.address || '',
    praxis_email: guiFields?.praxisEmail || branding.contactEmail || '',
    praxis_phone: guiFields?.praxisPhone || branding.contactPhone || '',
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

  const html = renderConfirmation(resolvedHtml, data)
  return NextResponse.json({ html })
}
