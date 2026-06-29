'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronRight, Euro, Calendar, Clock,
  Check, AlertCircle, FileText, Loader,
} from 'lucide-react'

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMins(m: number | null) {
  if (!m) return '—'
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60 > 0 ? m%60+'min' : ''}`.trim() : `${m} min`
}

const PAYMENT_LABELS: Record<string, string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung',
  CASH: 'Bar',
  CARD_BANKOMAT: 'Karte / Bankomat',
}

export function AbrechnenClient({
  patient, sessions: initialSessions, allUnbilled,
  invoiceTemplates, therapistName, role,
}: {
  patient: any
  sessions: any[]
  allUnbilled: any[]
  invoiceTemplates: any[]
  therapistName: string
  role: string
}) {
  const router = useRouter()

  // Ausgewählte Sessions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSessions.map((s: any) => s.id))
  )
  const selected = allUnbilled.filter(s => selectedIds.has(s.id))
  const totalNet = selected.reduce((sum, s) => sum + parseFloat(s.calculatedPriceNet ?? 0), 0)

  // Formular — vorausgefüllt aus Patientenprofil
  const payerNameDefault = patient.billRecipientName
    || `${patient.firstName} ${patient.lastName}`
  const payerAddressDefault = [patient.billRecipientAddress, patient.billRecipientCity]
    .filter(Boolean).join(', ')

  const [form, setForm] = useState({
    payerName:           payerNameDefault,
    payerAddress:        payerAddressDefault,
    vatRate:             parseFloat(patient.defaultVatRate ?? 0),
    paymentMethod:       patient.defaultPaymentMethod ?? 'UNBAR_BANK_TRANSFER',
    markAsPaid:          Boolean(patient.defaultMarkAsPaid),
    generateInvoiceDoc:  true,
    anonymizeInvoice:    false,
    invoiceTemplateId:   patient.defaultInvoiceTemplateId ?? '',
    notes:               '',
  })

  const vatAmount  = totalNet * form.vatRate
  const totalGross = totalNet + vatAmount

  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const [done,   setDone]     = useState<{ referenceNumber: string } | null>(null)

  const backUrl = `/patients/${patient.id}?tab=sitzungen`

  async function submit() {
    if (!form.payerName.trim()) { setError('Rechnungsempfänger fehlt.'); return }
    if (selectedIds.size === 0)  { setError('Keine Sitzungen ausgewählt.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/transactions/from-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds:        [...selectedIds],
          patientId:         patient.id,
          payerName:         form.payerName,
          payerAddress:      form.payerAddress,
          payeeName:         therapistName,
          vatRate:           form.vatRate,
          markAsPaid:        form.markAsPaid,
          paymentMethod:     form.paymentMethod,
          generateInvoiceDoc:form.generateInvoiceDoc,
          anonymizeInvoice:  form.anonymizeInvoice,
          invoiceTemplateId: form.invoiceTemplateId || null,
          notes:             form.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`)
      setDone({ referenceNumber: data.referenceNumber })
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--border)', borderRadius: 7,
    background: 'var(--surface-page)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
  const sectionStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }

  // ── Erfolgsseite ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zur Akte
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check style={{ width: 32, height: 32, color: 'var(--green)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Honorarnote erstellt</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {done.referenceNumber} · {selected.length} Sitzung{selected.length !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}
            </div>
            {form.markAsPaid && <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4 }}>✓ Als bezahlt markiert ({PAYMENT_LABELS[form.paymentMethod]})</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={() => router.push(backUrl)} className="btn-secondary" style={{ fontSize: 13 }}>
              Zurück zur Akte
            </button>
            <button onClick={() => router.push(`/finance`)} className="btn-secondary" style={{ fontSize: 13 }}>
              Zu Finanzen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Hauptseite ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zur Akte
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{patient.firstName} {patient.lastName}</span>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Honorarnote erstellen</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          <button onClick={submit} disabled={saving || selectedIds.size === 0} className="btn-primary" style={{ fontSize: 13, minWidth: 160 }}>
            {saving
              ? <><Loader style={{ width: 13, height: 13 }} /> Erstelle...</>
              : <><FileText style={{ width: 13, height: 13 }} /> Honorarnote erstellen</>}
          </button>
        </div>
      </div>

      {/* Body: zwei Spalten */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Linke Spalte: Sitzungsauswahl */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-page)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Sitzungen auswählen
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedIds(new Set(allUnbilled.map(s => s.id)))} className="btn-ghost" style={{ fontSize: 12 }}>Alle</button>
              <button onClick={() => setSelectedIds(new Set())} className="btn-ghost" style={{ fontSize: 12 }}>Keine</button>
            </div>
          </div>

          {allUnbilled.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Keine offenen Sitzungen vorhanden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allUnbilled.map(s => {
                const checked = selectedIds.has(s.id)
                return (
                  <label key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: checked ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const next = new Set(selectedIds)
                        if (e.target.checked) next.add(s.id)
                        else next.delete(s.id)
                        setSelectedIds(next)
                      }}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 2, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar style={{ width: 11, height: 11 }} />{fmtDate(s.sessionDate)}
                        </span>
                        {s.durationMinutes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock style={{ width: 11, height: 11 }} />{fmtMins(s.durationMinutes)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: checked ? 'var(--color-primary)' : 'var(--text-secondary)', flexShrink: 0 }}>
                      {fmtEUR(s.calculatedPriceNet)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {/* Summe */}
          {selected.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.length} Sitzung{selected.length !== 1 ? 'en' : ''} ausgewählt</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Netto: {fmtEUR(totalNet)}</div>
                {form.vatRate > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>MwSt. {Math.round(form.vatRate * 100)}%: {fmtEUR(vatAmount)}</div>}
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>Gesamt: {fmtEUR(totalGross)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Formular */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-card)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Rechnungsempfänger */}
          <div>
            <div style={sectionStyle}>Rechnungsempfänger</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.payerName}
                  onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input style={inputStyle} value={form.payerAddress}
                  onChange={e => setForm(f => ({ ...f, payerAddress: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* MwSt. & Zahlung */}
          <div>
            <div style={sectionStyle}>Abrechnung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelStyle}>MwSt.</label>
                <select style={inputStyle} value={form.vatRate}
                  onChange={e => setForm(f => ({ ...f, vatRate: parseFloat(e.target.value) }))}>
                  <option value={0}>0 % (keine MwSt.)</option>
                  <option value={0.1}>10 %</option>
                  <option value={0.2}>20 %</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zahlungsart</label>
                <select style={inputStyle} value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="UNBAR_BANK_TRANSFER">Überweisung</option>
                  <option value="CASH">Bar</option>
                  <option value="CARD_BANKOMAT">Karte / Bankomat</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.markAsPaid}
                  onChange={e => setForm(f => ({ ...f, markAsPaid: e.target.checked }))} />
                Sofort als bezahlt markieren
              </label>
            </div>
          </div>

          {/* Honorarnote */}
          <div>
            <div style={sectionStyle}>Honorarnote</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.generateInvoiceDoc}
                  onChange={e => setForm(f => ({ ...f, generateInvoiceDoc: e.target.checked }))} />
                PDF-Honorarnote generieren
              </label>
              {form.generateInvoiceDoc && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                    <input type="checkbox" checked={form.anonymizeInvoice}
                      onChange={e => setForm(f => ({ ...f, anonymizeInvoice: e.target.checked }))} />
                    Anonymisieren (Codename statt Klarname)
                  </label>
                  <div>
                    <label style={labelStyle}>Vorlage</label>
                    <select style={inputStyle} value={form.invoiceTemplateId}
                      onChange={e => setForm(f => ({ ...f, invoiceTemplateId: e.target.value }))}>
                      <option value="">Standard (automatisch)</option>
                      {invoiceTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' ★' : ''}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notiz */}
          <div>
            <div style={sectionStyle}>Notiz (optional)</div>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              value={form.notes} placeholder="Interne Notiz zur Transaktion"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Zusammenfassung */}
          {selected.length > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--color-primary-light)', borderRadius: 10, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 4 }}>Zusammenfassung</div>
              <div style={{ color: 'var(--text-primary)' }}>
                <div>{selected.length} Sitzung{selected.length !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}</div>
                <div>{form.generateInvoiceDoc ? '✓ Mit Honorarnote' : '– Ohne Honorarnote'}</div>
                <div>{form.markAsPaid ? `✓ Sofort bezahlt (${PAYMENT_LABELS[form.paymentMethod]})` : '⏳ Zahlung ausstehend'}</div>
                <div>Empfänger: {form.payerName || <span style={{ color: 'var(--red)' }}>fehlt!</span>}</div>
              </div>
            </div>
          )}

          <button onClick={submit} disabled={saving || selectedIds.size === 0 || !form.payerName.trim()}
            className="btn-primary" style={{ fontSize: 14, padding: '10px 0', justifyContent: 'center', width: '100%' }}>
            {saving
              ? <><Loader style={{ width: 14, height: 14 }} /> Erstelle Honorarnote...</>
              : <><FileText style={{ width: 14, height: 14 }} /> Honorarnote erstellen</>}
          </button>
        </div>
      </div>
    </div>
  )
}
