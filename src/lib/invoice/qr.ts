import QRCode from 'qrcode'

/**
 * Erzeugt einen echten, scanbaren SEPA-Überweisungs-QR-Code ("GiroCode")
 * nach EPC069-12-Standard. Wird von praktisch allen österreichischen und
 * deutschen Banking-Apps unterstützt (Überweisung wird automatisch befüllt).
 *
 * Spezifikation: https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 */
export interface EpcQrParams {
  iban: string
  bic?: string
  beneficiaryName: string
  amount: number          // Bruttobetrag in EUR
  reference: string       // z.B. Rechnungsnummer
}

function truncate(s: string, max: number): string {
  return (s ?? '').slice(0, max)
}

export function buildEpcPayload(params: EpcQrParams): string {
  const iban = (params.iban || '').replace(/\s+/g, '').toUpperCase()
  const bic = (params.bic || '').replace(/\s+/g, '').toUpperCase()
  const amount = Math.max(0, Math.round((params.amount ?? 0) * 100) / 100)

  const lines = [
    'BCD',                                  // Service Tag
    '002',                                  // Version
    '1',                                    // Zeichensatz: 1 = UTF-8
    'SCT',                                  // SEPA Credit Transfer
    truncate(bic, 11),                      // BIC (optional, darf leer sein)
    truncate(params.beneficiaryName, 70),   // Empfänger
    truncate(iban, 34),                     // IBAN
    `EUR${amount.toFixed(2)}`,              // Betrag
    '',                                     // Verwendungszweck (Purpose Code) - optional
    '',                                     // Strukturierte Referenz - nicht verwendet
    truncate(params.reference, 140),        // Unstrukturierte Verwendungszweck-Info
  ]
  return lines.join('\n')
}

/**
 * Rendert den EPC-QR-Code als PNG-Data-URL. Gibt null zurück wenn keine
 * gültige IBAN vorhanden ist (kein Platzhalter, einfach kein QR-Code).
 */
export async function generateEpcQrDataUrl(params: EpcQrParams): Promise<string | null> {
  const iban = (params.iban || '').replace(/\s+/g, '')
  if (!iban) return null
  try {
    const payload = buildEpcPayload(params)
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    })
  } catch (e) {
    console.error('[qr] EPC-QR-Code konnte nicht erzeugt werden:', e)
    return null
  }
}

export function qrImageHtml(dataUrl: string): string {
  return `<div style="flex-shrink:0; text-align:center;">
      <img src="${dataUrl}" style="width:90px;height:90px;display:block;" alt="QR-Code für SEPA-Überweisung">
      <div style="font-size:7.5pt;color:#888;margin-top:2px;">Scan to Pay</div>
    </div>`
}
