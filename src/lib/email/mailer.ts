import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decryptString } from '@/lib/security/encryption'

export interface SendMailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
  replyTo?: string
}

export async function getSmtpConfig() {
  return prisma.smtpConfig.findFirst({ where: { isActive: true } })
}

export async function sendMail(opts: SendMailOptions): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmtpConfig()
  if (!config) return { ok: false, error: 'Kein SMTP konfiguriert. Bitte unter Administration → E-Mail einrichten.' }

  // Kein Klartext-Fallback: schlägt die Entschlüsselung fehl (ENCRYPTION_KEY fehlt/ungültig,
  // oder das Passwort ist noch unverschlüsselter Alt-Bestand), bricht der Mailversand hart
  // ab statt mit einem falschen/unverschlüsselten Wert weiterzumachen.
  let decryptedPassword: string
  try {
    decryptedPassword = decryptString(config.password)
  } catch (e: any) {
    return { ok: false, error: `SMTP-Passwort konnte nicht entschlüsselt werden: ${e.message}` }
  }

  const transporter = nodemailer.createTransport({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   { user: config.user, pass: decryptedPassword },
    tls:    { rejectUnauthorized: false }, // Self-signed certs erlaubt
  })

  try {
    await transporter.sendMail({
      from:    `"${config.fromName}" <${config.fromEmail}>`,
      replyTo: opts.replyTo ?? config.replyTo ?? config.fromEmail,
      to:      Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
      attachments: opts.attachments,
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'SMTP-Fehler' }
  }
}

export async function sendTestMail(toEmail: string): Promise<{ ok: boolean; error?: string }> {
  return sendMail({
    to:      toEmail,
    subject: 'KDS – SMTP Testmail ✓',
    html: `
      <div style="font-family:sans-serif;padding:32px;max-width:500px">
        <h2 style="color:#4f46e5">SMTP-Verbindung erfolgreich ✓</h2>
        <p>Diese Testmail wurde von <strong>KDS – Klinisches Dokumentationssystem</strong> versendet.</p>
        <p style="color:#888;font-size:12px">Gesendet: ${new Date().toLocaleString('de-AT')}</p>
      </div>
    `,
    text: 'KDS SMTP Testmail – Verbindung erfolgreich.',
  })
}

// E-Mail Template für Honorarnote
export function buildInvoiceEmail({
  patientName, referenceNumber, amount, dueDate, praxisName,
}: {
  patientName: string
  referenceNumber: string
  amount: string
  dueDate?: string
  praxisName: string
}): { subject: string; html: string; text: string } {
  const subject = `Honorarnote ${referenceNumber} – ${praxisName}`
  const html = `
    <div style="font-family:sans-serif;padding:32px;max-width:600px;color:#1a1a2e">
      <h2 style="color:#4f46e5;margin-bottom:4px">${praxisName}</h2>
      <p style="color:#888;margin-top:0">Psychotherapeutische Praxis</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p>Sehr geehrte/r ${patientName},</p>
      <p>anbei erhalten Sie Ihre Honorarnote für die erbrachten psychotherapeutischen Leistungen.</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">Rechnungsnummer</span>
          <strong>${referenceNumber}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">Betrag</span>
          <strong style="color:#4f46e5">${amount}</strong>
        </div>
        ${dueDate ? `<div style="display:flex;justify-content:space-between">
          <span style="color:#666">Fällig bis</span>
          <strong>${dueDate}</strong>
        </div>` : ''}
      </div>
      <p>Die Honorarnote finden Sie im Anhang dieser E-Mail als PDF / HTML-Datei.</p>
      <p>Bei Fragen stehe ich Ihnen gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen<br><strong>${praxisName}</strong></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p style="font-size:11px;color:#aaa">Diese E-Mail wurde automatisch von KDS generiert.</p>
    </div>
  `
  const text = `Honorarnote ${referenceNumber}\nBetrag: ${amount}${dueDate ? `\nFällig bis: ${dueDate}` : ''}\n\nBei Fragen wenden Sie sich bitte an ${praxisName}.`
  return { subject, html, text }
}

// E-Mail Template für Mahnschreiben (Zahlungserinnerung / Mahnung)
export function buildDunningEmail({
  level, patientName, referenceNumber, amount, praxisName,
}: {
  level: 'ERINNERUNG' | 'MAHNUNG_1' | 'MAHNUNG_2'
  patientName: string
  referenceNumber: string
  amount: string
  praxisName: string
}): { subject: string; html: string; text: string } {
  const titles: Record<string, string> = { ERINNERUNG: 'Zahlungserinnerung', MAHNUNG_1: '1. Mahnung', MAHNUNG_2: '2. Mahnung' }
  const title = titles[level]
  const subject = `${title} – Honorarnote ${referenceNumber} – ${praxisName}`
  const html = `
    <div style="font-family:sans-serif;padding:32px;max-width:600px;color:#1a1a2e">
      <h2 style="color:#4f46e5;margin-bottom:4px">${praxisName}</h2>
      <p style="color:#888;margin-top:0">Psychotherapeutische Praxis</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p>Sehr geehrte/r ${patientName},</p>
      <p>anbei erhalten Sie unsere ${title} zur unten angeführten, noch offenen Honorarnote. Die Details und den genauen Wortlaut entnehmen Sie bitte dem beigefügten PDF.</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">Rechnungsnummer</span>
          <strong>${referenceNumber}</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#666">Offener Betrag</span>
          <strong style="color:#4f46e5">${amount}</strong>
        </div>
      </div>
      <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen<br><strong>${praxisName}</strong></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p style="font-size:11px;color:#aaa">Diese E-Mail wurde automatisch von KDS generiert.</p>
    </div>
  `
  const text = `${title} – Honorarnote ${referenceNumber}\nOffener Betrag: ${amount}\n\nDetails siehe beigefügtes PDF. Bei Fragen wenden Sie sich bitte an ${praxisName}.`
  return { subject, html, text }
}
