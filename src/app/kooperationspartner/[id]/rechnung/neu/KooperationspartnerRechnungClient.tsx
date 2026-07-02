'use client'
import { useState, useEffect, useRef, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, ChevronRight, Calendar, Clock,
  Check, AlertCircle, FileText, Loader, Printer, Mail, X, Eye, RefreshCw, Plus,
} from 'lucide-react'

const RichTextEditor = dynamic(
  () => import('@/components/editor/RichTextEditor').then(m => m.RichTextEditor),
  { ssr: false, loading: () => <div style={{ height: 60, background: 'var(--surface-page)', borderRadius: 8 }} /> }
)

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
// Next.js/React Server Components geben Date-Felder als echte Date-Objekte an
// Client-Komponenten weiter (nicht als String) — daher hier immer normalisieren,
// bevor irgendwo .slice() o.ä. auf einem Datum aufgerufen wird.
function toDateInputValue(d: any): string | null {
  if (!d) return null
  if (typeof d === 'string') return d
  if (d instanceof Date) return d.toISOString()
  return String(d)
}

const PAYMENT_LABELS: Record<string, string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung',
  CASH: 'Bar',
  CARD_BANKOMAT: 'Karte / Bankomat',
}

interface LineItem {
  tempId: string
  description: string
  descriptionHtml?: string
  quantity: number
  unitPriceNet: number
  sessionId?: string | null
  patientName?: string | null
  lineDate?: string | null
}

let tempIdCounter = 0
function newTempId() { return `tmp-${Date.now()}-${tempIdCounter++}` }

export function KooperationspartnerRechnungClient({
  partner, unbilledSessions, invoiceTemplates, therapistName, branding,
}: {
  partner: any
  unbilledSessions: any[]
  invoiceTemplates: { id: string; name: string; isDefault: boolean }[]
  therapistName: string
  branding: {
    praxisName: string
    address: string | null
    contactEmail: string | null
    contactPhone: string | null
    logoBase64: string | null
    logoMimeType: string | null
    colorPrimary: string
  }
}) {
  const router = useRouter()
  const backUrl = `/kooperationspartner/${partner.id}`

  // ── Positionsliste (frei editierbar) ──
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const addedSessionIds = new Set(lineItems.filter(l => l.sessionId).map(l => l.sessionId))

  function addSession(s: any) {
    const patientName = `${s.patient.firstName} ${s.patient.lastName}`
    const newLines: LineItem[] = []
    const basePrice = parseFloat(s.calculatedPriceNet ?? 0)
    if (basePrice > 0 || s.serviceLines.length === 0) {
      newLines.push({
        tempId: newTempId(),
        description: `${patientName} — Sitzung-${s.sessionNumber}`,
        quantity: 1,
        unitPriceNet: basePrice,
        sessionId: s.id,
        patientName,
        lineDate: toDateInputValue(s.sessionDate),
      })
    }
    for (const line of s.serviceLines) {
      newLines.push({
        tempId: newTempId(),
        description: `${patientName} — ${line.description}`,
        quantity: parseFloat(line.quantity),
        unitPriceNet: parseFloat(line.unitPriceNet),
        sessionId: s.id,
        patientName,
        lineDate: toDateInputValue(s.sessionDate),
      })
    }
    setLineItems(li => [...li, ...newLines])
  }

  function removeSession(sessionId: string) {
    setLineItems(li => li.filter(l => l.sessionId !== sessionId))
  }

  function updateLine(tempId: string, patch: Partial<LineItem>) {
    setLineItems(li => li.map(l => l.tempId === tempId ? { ...l, ...patch } : l))
  }
  function removeLine(tempId: string) {
    setLineItems(li => li.filter(l => l.tempId !== tempId))
  }

  // ── Freie Position hinzufügen ──
  const todayStr = new Date().toISOString().slice(0, 10)
  const [freeLine, setFreeLine] = useState({ description: '', quantity: 1, unitPriceNet: 0, lineDate: todayStr })
  function addFreeLine() {
    setLineItems(li => [...li, {
      tempId: newTempId(),
      description: freeLine.description.trim() || 'Position',
      quantity: freeLine.quantity,
      unitPriceNet: freeLine.unitPriceNet,
      lineDate: freeLine.lineDate || null,
    }])
    setFreeLine({ description: '', quantity: 1, unitPriceNet: 0, lineDate: todayStr })
  }

  const totalNet = lineItems.reduce((s, l) => s + l.quantity * l.unitPriceNet, 0)

  // ── Formular ──
  const [form, setForm] = useState({
    payerName: partner.name,
    payerAddress: [partner.address, [partner.postalCode, partner.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    vatRate: parseFloat(partner.defaultVatRate ?? 0),
    paymentMethod: partner.defaultPaymentMethod ?? 'UNBAR_BANK_TRANSFER',
    markAsPaid: false,
    generateInvoiceDoc: true,
    invoiceTemplateId: partner.defaultInvoiceTemplateId ?? '',
    notes: '',
  })

  const vatAmount = totalNet * form.vatRate
  const totalGross = totalNet + vatAmount

  // ── Live-Vorschau ──
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewDebounce = useRef<NodeJS.Timeout>()

  useEffect(() => {
    clearTimeout(previewDebounce.current)
    if (lineItems.length === 0) { setPreviewHtml(''); return }
    previewDebounce.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/cooperation-partners/${partner.id}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineItems, payerName: form.payerName, payerAddress: form.payerAddress,
            vatRate: form.vatRate, invoiceTemplateId: form.invoiceTemplateId || null, notes: form.notes,
          }),
        })
        const data = await res.json()
        if (res.ok) setPreviewHtml(data.html ?? '')
      } catch { /* nicht kritisch */ }
      setPreviewLoading(false)
    }, 500)
    return () => clearTimeout(previewDebounce.current)
  }, [lineItems, form.payerName, form.payerAddress, form.vatRate, form.invoiceTemplateId, form.notes, partner.id])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customNoteHtml, setCustomNoteHtml] = useState('')
  const [done, setDone] = useState<{ referenceNumber: string; transactionId?: string; invoiceHtml?: string } | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailTo, setEmailTo] = useState(partner.email ?? '')
  const [emailMsg, setEmailMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [emailErr, setEmailErr] = useState('')

  async function submit() {
    if (!form.payerName.trim()) { setError('Rechnungsempfänger fehlt.'); return }
    if (lineItems.length === 0) { setError('Keine Positionen vorhanden.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/cooperation-partners/${partner.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerName: form.payerName,
          payerAddress: form.payerAddress,
          payeeName: therapistName,
          vatRate: form.vatRate,
          markAsPaid: form.markAsPaid,
          paymentMethod: form.paymentMethod,
          generateInvoiceDoc: form.generateInvoiceDoc,
          invoiceTemplateId: form.invoiceTemplateId || null,
          notes: form.notes,
          lineItems: lineItems.map(l => ({
            description: l.description, quantity: l.quantity, unitPriceNet: l.unitPriceNet,
            descriptionHtml: l.descriptionHtml || null,
            sessionId: l.sessionId || null, lineDate: l.lineDate || null,
          })),
          customNoteHtml: customNoteHtml || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`)
      setDone({ referenceNumber: data.referenceNumber, transactionId: data.transactionId, invoiceHtml: data.invoiceHtml })
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function sendInvoiceEmail() {
    if (!done?.transactionId || !emailTo) return
    setSending(true); setEmailErr('')
    try {
      const res = await fetch('/api/transactions/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: done.transactionId, toEmail: emailTo, message: emailMsg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setEmailDone(true)
      setShowEmailForm(false)
    } catch (e: any) { setEmailErr(e.message) }
    setSending(false)
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--border)', borderRadius: 7,
    background: 'var(--surface-page)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
  const sectionStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }

  // Borderloses "Zellen"-Eingabefeld, das erst bei Fokus/Hover als Feld erkennbar
  // wird — für das Word/Excel-artige Gefühl direkt im Rechnungs-Papier.
  const cellInputBase: CSSProperties = {
    border: '1px solid transparent', borderRadius: 5, background: 'transparent',
    font: 'inherit', color: 'inherit', padding: '3px 5px', boxSizing: 'border-box',
    outline: 'none',
  }
  const cellFocusHandlers = {
    onFocus: (e: FocusEvent<HTMLInputElement>) => { e.target.style.border = '1px solid var(--color-primary)'; e.target.style.background = '#fff' },
    onBlur:  (e: FocusEvent<HTMLInputElement>) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' },
    onMouseEnter: (e: MouseEvent<HTMLInputElement>) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid #d8dce3' },
    onMouseLeave: (e: MouseEvent<HTMLInputElement>) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid transparent' },
  }

  // ── Erfolgsseite ──
  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zu {partner.name}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 720 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check style={{ width: 32, height: 32, color: 'var(--green)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Rechnung erstellt</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {done.referenceNumber} · {lineItems.length} Position{lineItems.length !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}
              </div>
              {form.markAsPaid && <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4 }}>✓ Als bezahlt markiert ({PAYMENT_LABELS[form.paymentMethod]})</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => router.push(backUrl)} className="btn-secondary" style={{ fontSize: 13 }}>
                Zurück zu {partner.name}
              </button>
              {done?.transactionId && (
                <button onClick={() => window.open(`/api/transactions/${done.transactionId}/invoice`, '_blank')} className="btn-secondary" style={{ fontSize: 13 }}>
                  <Printer style={{ width: 13, height: 13 }} /> Drucken / PDF
                </button>
              )}
              <button onClick={() => setShowEmailForm(s => !s)} className="btn-primary" style={{ fontSize: 13 }}>
                <Mail style={{ width: 13, height: 13 }} /> Per E-Mail senden
              </button>
              <button onClick={() => router.push('/finance')} className="btn-secondary" style={{ fontSize: 13 }}>
                Zu Finanzen
              </button>
            </div>

            {done.invoiceHtml && (
              <div style={{ width: '100%', marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'left' }}>Vorschau</div>
                <iframe srcDoc={done.invoiceHtml} title="Rechnung-Vorschau"
                  style={{ width: '100%', height: 480, border: '0.5px solid var(--border)', borderRadius: 10, background: '#fff' }} />
              </div>
            )}

            {showEmailForm && (
              <div style={{ width: '100%', maxWidth: 440, marginTop: 16, padding: 16, background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Rechnung per E-Mail senden</span>
                  <button onClick={() => setShowEmailForm(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 14, height: 14 }} /></button>
                </div>
                <div>
                  <label style={labelStyle}>Empfänger *</label>
                  <input type="email" style={inputStyle} value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="partner@email.at" />
                </div>
                <div>
                  <label style={labelStyle}>Persönliche Nachricht (optional)</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={emailMsg} onChange={e => setEmailMsg(e.target.value)} placeholder="Optionale Nachricht..." />
                </div>
                {emailErr && <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle style={{ width: 13, height: 13 }} />{emailErr}</div>}
                {emailDone && <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}><Check style={{ width: 13, height: 13 }} />E-Mail erfolgreich gesendet!</div>}
                <button onClick={sendInvoiceEmail} disabled={sending || !emailTo || emailDone} className="btn-primary" style={{ fontSize: 13, justifyContent: 'center' }}>
                  {sending ? 'Sende...' : <><Mail style={{ width: 13, height: 13 }} /> Senden</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Hauptseite ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{partner.name}</span>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Rechnung erstellen</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          <button onClick={submit} disabled={saving || lineItems.length === 0} className="btn-primary" style={{ fontSize: 13, minWidth: 160 }}>
            {saving ? <><Loader style={{ width: 13, height: 13 }} /> Erstelle...</> : <><FileText style={{ width: 13, height: 13 }} /> Rechnung erstellen</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Linke Spalte */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-page)' }}>

          {/* Sitzungen hinzufügen */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>Offene Sitzungen</h2>
            {unbilledSessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
                Keine offenen Sitzungen bei Patienten dieses Partners.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unbilledSessions.map(s => {
                  const added = addedSessionIds.has(s.id)
                  const extraTotal = s.serviceLines.reduce((sum: number, l: any) => sum + parseFloat(l.amountNet), 0)
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: added ? 'var(--color-primary-light)' : 'var(--surface-card)',
                      border: '0.5px solid var(--border)', borderRadius: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.patient.firstName} {s.patient.lastName} — Sitzung-{s.sessionNumber}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ width: 11, height: 11 }} />{fmtDate(s.sessionDate)}</span>
                          {s.durationMinutes && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ width: 11, height: 11 }} />{s.durationMinutes} min</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {fmtEUR(parseFloat(s.calculatedPriceNet ?? 0) + extraTotal)}
                        {extraTotal > 0 && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>inkl. Zusatzleistungen</div>}
                      </div>
                      {added ? (
                        <button onClick={() => removeSession(s.id)} className="btn-secondary" style={{ fontSize: 12 }}>Entfernen</button>
                      ) : (
                        <button onClick={() => addSession(s)} className="btn-primary" style={{ fontSize: 12 }}>
                          <Plus style={{ width: 12, height: 12 }} /> Hinzufügen
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Freie Position */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>Freie Position hinzufügen</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: 12, background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Beschreibung</label>
                <input style={inputStyle} value={freeLine.description}
                  onChange={e => setFreeLine(f => ({ ...f, description: e.target.value }))}
                  placeholder="z.B. Pauschale Juni 2026" />
              </div>
              <div style={{ width: 140 }}>
                <label style={labelStyle}>Datum</label>
                <input type="date" style={inputStyle} value={freeLine.lineDate}
                  onChange={e => setFreeLine(f => ({ ...f, lineDate: e.target.value }))} />
              </div>
              <div style={{ width: 70 }}>
                <label style={labelStyle}>Menge</label>
                <input type="number" step="0.5" style={inputStyle} value={freeLine.quantity}
                  onChange={e => setFreeLine(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div style={{ width: 100 }}>
                <label style={labelStyle}>Preis/Einh.</label>
                <input type="number" step="0.01" style={inputStyle} value={freeLine.unitPriceNet}
                  onChange={e => setFreeLine(f => ({ ...f, unitPriceNet: parseFloat(e.target.value) || 0 }))} />
              </div>
              <button onClick={addFreeLine} className="btn-primary" style={{ fontSize: 12, height: 36 }}>
                <Plus style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>

          {/* Die Rechnung selbst — direkt darin editieren, wie in Word/Excel */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Rechnung {lineItems.length > 0 && `(${lineItems.length} Position${lineItems.length !== 1 ? 'en' : ''})`}
            </h2>
            {lineItems.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
                Noch keine Positionen — Sitzung hinzufügen oder freie Position eintragen.
              </div>
            ) : (
              <div style={{
                background: '#fff', borderRadius: 12, border: '0.5px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '30px 34px', color: '#1a1a1a',
              }}>
                {/* Header: Logo/Praxis links, Kontakt rechts */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    {branding.logoBase64 && (
                      <img src={`data:${branding.logoMimeType || 'image/png'};base64,${branding.logoBase64}`}
                        alt="Logo" style={{ height: 42, marginBottom: 6, display: 'block' }} />
                    )}
                    <div style={{ fontSize: 17, fontWeight: 700, color: branding.colorPrimary }}>{branding.praxisName}</div>
                    {branding.address && <div style={{ fontSize: 11.5, color: '#666', marginTop: 2 }}>{branding.address}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#666' }}>
                    {branding.contactEmail && <div>{branding.contactEmail}</div>}
                    {branding.contactPhone && <div>{branding.contactPhone}</div>}
                  </div>
                </div>
                <div style={{ borderTop: `2px solid ${branding.colorPrimary}`, marginBottom: 20 }} />

                {/* Empfänger + Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22, gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: '#999', marginBottom: 4 }}>RECHNUNG AN</div>
                    <input value={form.payerName}
                      onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))}
                      style={{ ...cellInputBase, fontSize: 14, fontWeight: 600, width: '100%', marginBottom: 2 }}
                      {...cellFocusHandlers} placeholder="Name des Empfängers" />
                    <input value={form.payerAddress}
                      onChange={e => setForm(f => ({ ...f, payerAddress: e.target.value }))}
                      style={{ ...cellInputBase, fontSize: 12, color: '#555', width: '100%' }}
                      {...cellFocusHandlers} placeholder="Adresse (optional)" />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#555', flexShrink: 0, lineHeight: 1.7 }}>
                    <div>Rechnungsnummer&nbsp; <strong>VORSCHAU</strong></div>
                    <div>Rechnungsdatum&nbsp; <strong>{fmtDate(new Date())}</strong></div>
                  </div>
                </div>

                <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 14px', color: '#1a1a1a' }}>Rechnung</h1>

                {/* Positions-Tabelle — jede Zelle direkt editierbar */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${branding.colorPrimary}` }}>
                      <th style={{ textAlign: 'left', padding: '0 6px 8px 4px', fontSize: 11, color: '#888', fontWeight: 600, width: 108 }}>Datum</th>
                      <th style={{ textAlign: 'left', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Beschreibung</th>
                      <th style={{ textAlign: 'center', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600, width: 54 }}>Anz.</th>
                      <th style={{ textAlign: 'right', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600, width: 84 }}>Einzel €</th>
                      <th style={{ textAlign: 'right', padding: '0 4px 8px 6px', fontSize: 11, color: '#888', fontWeight: 600, width: 84 }}>Gesamt €</th>
                      <th style={{ width: 26 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(l => (
                      <tr key={l.tempId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 6px 6px 4px', verticalAlign: 'top' }}>
                          <input type="date"
                            value={l.lineDate ? l.lineDate.slice(0, 10) : ''}
                            onChange={e => updateLine(l.tempId, { lineDate: e.target.value || null })}
                            style={{ ...cellInputBase, width: '100%' }} {...cellFocusHandlers} />
                          {l.patientName && (
                            <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2, paddingLeft: 5 }}>{l.patientName}</div>
                          )}
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <RichTextEditor
                            compact
                            value={l.descriptionHtml || l.description}
                            onChange={html => updateLine(l.tempId, {
                              descriptionHtml: html,
                              description: html.replace(/<[^>]+>/g, '') || l.description,
                            })}
                            minHeight={22}
                            placeholder="Beschreibung…"
                          />
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <input type="number" step="0.5"
                            value={l.quantity}
                            onChange={e => updateLine(l.tempId, { quantity: parseFloat(e.target.value) || 0 })}
                            style={{ ...cellInputBase, width: '100%', textAlign: 'center' }} {...cellFocusHandlers} />
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <input type="number" step="0.01"
                            value={l.unitPriceNet}
                            onChange={e => updateLine(l.tempId, { unitPriceNet: parseFloat(e.target.value) || 0 })}
                            style={{ ...cellInputBase, width: '100%', textAlign: 'right' }} {...cellFocusHandlers} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, verticalAlign: 'top', paddingTop: 12 }}>
                          {fmtEUR(l.quantity * l.unitPriceNet)}
                        </td>
                        <td style={{ verticalAlign: 'top', paddingTop: 8 }}>
                          <button onClick={() => l.sessionId ? removeSession(l.sessionId) : removeLine(l.tempId)}
                            className="btn-ghost" style={{ padding: 3, color: 'var(--text-muted)' }}
                            title={l.sessionId ? 'Sitzung entfernen' : 'Position entfernen'}>
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summenblock */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <div style={{ width: 230 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                      <span style={{ color: '#666' }}>Nettobetrag</span>
                      <span>{fmtEUR(totalNet)}</span>
                    </div>
                    {form.vatRate > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                        <span style={{ color: '#666' }}>MwSt. {Math.round(form.vatRate * 100)}%</span>
                        <span>{fmtEUR(vatAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: '1.5px solid #1a1a1a', fontSize: 15, fontWeight: 700 }}>
                      <span>Gesamtbetrag</span>
                      <span>{fmtEUR(totalGross)}</span>
                    </div>
                  </div>
                </div>

                {/* Freitext — direkt im Papier, erscheint unter den Positionen */}
                <div style={{ marginTop: 22, paddingTop: 14, borderTop: '0.5px solid #eee' }}>
                  <RichTextEditor
                    value={customNoteHtml}
                    onChange={setCustomNoteHtml}
                    placeholder="Optionaler Freitext, der unter den Positionen erscheint (Fettdruck, Listen, Farben…)"
                    minHeight={60}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summe */}
          {lineItems.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lineItems.length} Position{lineItems.length !== 1 ? 'en' : ''}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Netto: {fmtEUR(totalNet)}</div>
                {form.vatRate > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>MwSt. {Math.round(form.vatRate * 100)}%: {fmtEUR(vatAmount)}</div>}
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>Gesamt: {fmtEUR(totalGross)}</div>
              </div>
            </div>
          )}

          {/* Live-Vorschau */}
          {lineItems.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Vorschau</span>
                {previewLoading && <RefreshCw style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />}
              </div>
              {previewHtml ? (
                <iframe srcDoc={previewHtml} title="Rechnung-Vorschau"
                  style={{ width: '100%', height: 600, border: '0.5px solid var(--border)', borderRadius: 10, background: '#fff' }} />
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 10 }}>
                  {previewLoading ? 'Lade Vorschau…' : 'Vorschau erscheint hier'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rechte Spalte: Formular */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-card)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <div style={sectionStyle}>Rechnungsempfänger</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.payerName} onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input style={inputStyle} value={form.payerAddress} onChange={e => setForm(f => ({ ...f, payerAddress: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <div style={sectionStyle}>Abrechnung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelStyle}>MwSt.</label>
                <select style={inputStyle} value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: parseFloat(e.target.value) }))}>
                  <option value={0}>0 % (keine MwSt.)</option>
                  <option value={0.1}>10 %</option>
                  <option value={0.2}>20 %</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zahlungsart</label>
                <select style={inputStyle} value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="UNBAR_BANK_TRANSFER">Überweisung</option>
                  <option value="CASH">Bar</option>
                  <option value="CARD_BANKOMAT">Karte / Bankomat</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.markAsPaid} onChange={e => setForm(f => ({ ...f, markAsPaid: e.target.checked }))} />
                Sofort als bezahlt markieren
              </label>
            </div>
          </div>

          <div>
            <div style={sectionStyle}>Rechnung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.generateInvoiceDoc} onChange={e => setForm(f => ({ ...f, generateInvoiceDoc: e.target.checked }))} />
                PDF-Rechnung generieren
              </label>
              {form.generateInvoiceDoc && (
                <div>
                  <label style={labelStyle}>Vorlage</label>
                  <select style={inputStyle} value={form.invoiceTemplateId} onChange={e => setForm(f => ({ ...f, invoiceTemplateId: e.target.value }))}>
                    <option value="">Standard (automatisch)</option>
                    {invoiceTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' ★' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={sectionStyle}>Notiz (optional)</div>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              value={form.notes} placeholder="Interne Notiz zur Rechnung"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {lineItems.length > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--color-primary-light)', borderRadius: 10, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 4 }}>Zusammenfassung</div>
              <div style={{ color: 'var(--text-primary)' }}>
                <div>{lineItems.length} Position{lineItems.length !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}</div>
                <div>{form.generateInvoiceDoc ? '✓ Mit Rechnung' : '– Ohne Rechnung'}</div>
                <div>{form.markAsPaid ? `✓ Sofort bezahlt (${PAYMENT_LABELS[form.paymentMethod]})` : '⏳ Zahlung ausstehend'}</div>
                <div>Empfänger: {form.payerName || <span style={{ color: 'var(--red)' }}>fehlt!</span>}</div>
              </div>
            </div>
          )}

          <button onClick={submit} disabled={saving || lineItems.length === 0 || !form.payerName.trim()}
            className="btn-primary" style={{ fontSize: 13, justifyContent: 'center', padding: '10px' }}>
            {saving ? <><Loader style={{ width: 13, height: 13 }} /> Erstelle...</> : <><FileText style={{ width: 13, height: 13 }} /> Rechnung erstellen</>}
          </button>
        </div>
      </div>
    </div>
  )
}
