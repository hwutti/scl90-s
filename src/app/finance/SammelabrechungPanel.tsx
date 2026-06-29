'use client'
import { useState, useEffect, useCallback } from 'react'
import { Euro, Check, AlertCircle, Loader, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(new Date(d))
}

const PAYMENT_LABELS: Record<string, string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung',
  CASH: 'Bar',
  CARD_BANKOMAT: 'Karte',
}

interface PatientEntry {
  patient: any
  sessions: any[]
  totalNet: number
}

export function SammelabrechungPanel({ year }: { year: number }) {
  const now = new Date()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to,   setTo]   = useState(`${year}-12-31`)
  const [data, setData] = useState<{ patients: PatientEntry[]; totalPatients: number; totalSessions: number; totalNet: number } | null>(null)
  const [loading, setLoading] = useState(false)

  // Auswahl
  const [selected, setSelected] = useState<Set<string>>(new Set()) // patientIds
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Pro Patient: Overrides (falls Therapeut etwas anpassen will)
  interface Override { vatRate: number; paymentMethod: string; markAsPaid: boolean; generateInvoice: boolean }
  const [overrides, setOverrides] = useState<Record<string, Override>>({})

  // Ergebnisse
  const [running, setRunning]   = useState(false)
  const [results, setResults]   = useState<{ patientId: string; name: string; referenceNumber?: string; error?: string }[]>([])
  const [done, setDone]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/sammelabrechnung?from=${from}&to=${to}`)
      const d = await res.json()
      setData(d)
      // Alle vorauswählen
      setSelected(new Set(d.patients.map((p: PatientEntry) => p.patient.id)))
      // Overrides aus Patientenprofil vorausfüllen
      const ov: typeof overrides = {}
      for (const entry of d.patients) {
        ov[entry.patient.id] = {
          vatRate:        parseFloat(entry.patient.defaultVatRate ?? 0),
          paymentMethod:  entry.patient.defaultPaymentMethod ?? 'UNBAR_BANK_TRANSFER',
          markAsPaid:     Boolean(entry.patient.defaultMarkAsPaid),
          generateInvoice: true,
        }
      }
      setOverrides(ov)
    } catch { /* ignore */ }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  async function runSammelabrechnung() {
    if (!data || selected.size === 0) return
    setRunning(true); setDone(false); setResults([])

    const items = data.patients
      .filter(e => selected.has(e.patient.id))
      .map(e => {
        const ov = overrides[e.patient.id] ?? {}
        const payerName = e.patient.billRecipientName
          || `${e.patient.firstName} ${e.patient.lastName}`
        const payerAddr = [e.patient.billRecipientAddress, e.patient.billRecipientCity].filter(Boolean).join(', ')
        return {
          patientId:         e.patient.id,
          sessionIds:        e.sessions.map((s: any) => s.id),
          payerName,
          payerAddress:      payerAddr,
          vatRate:           ov.vatRate ?? 0,
          paymentMethod:     ov.paymentMethod ?? 'UNBAR_BANK_TRANSFER',
          markAsPaid:        ov.markAsPaid ?? false,
          generateInvoiceDoc: ov.generateInvoice ?? true,
          invoiceTemplateId: e.patient.defaultInvoiceTemplateId ?? null,
        }
      })

    const res  = await fetch('/api/finance/sammelabrechnung', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const resp = await res.json()
    setResults(resp.results.map((r: any) => ({
      ...r,
      name: data.patients.find(e => e.patient.id === r.patientId)?.patient
        ? `${data.patients.find(e => e.patient.id === r.patientId)!.patient.firstName} ${data.patients.find(e => e.patient.id === r.patientId)!.patient.lastName}`
        : r.patientId,
    })))
    setDone(true)
    setRunning(false)
    load() // Refresh
  }

  const selectedEntries = data?.patients.filter(e => selected.has(e.patient.id)) ?? []
  const selectedTotal   = selectedEntries.reduce((s, e) => s + e.totalNet, 0)

  const inputStyle = { padding: '6px 9px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--surface-page)', color: 'var(--text-primary)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Sammelabrechnung</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Alle offenen Sitzungen auf einmal abrechnen</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <label style={{ color: 'var(--text-muted)' }}>Von</label>
            <input type="date" style={inputStyle} value={from} onChange={e => setFrom(e.target.value)} />
            <label style={{ color: 'var(--text-muted)' }}>Bis</label>
            <input type="date" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button onClick={load} className="btn-secondary" style={{ fontSize: 12 }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Aktualisieren
          </button>
        </div>
      </div>

      {/* Schnellauswahl Zeiträume */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: 'Gesamtes Jahr', from: `${year}-01-01`, to: `${year}-12-31` },
          { label: 'Q1', from: `${year}-01-01`, to: `${year}-03-31` },
          { label: 'Q2', from: `${year}-04-01`, to: `${year}-06-30` },
          { label: 'Q3', from: `${year}-07-01`, to: `${year}-09-30` },
          { label: 'Q4', from: `${year}-10-01`, to: `${year}-12-31` },
          { label: 'Letzter Monat', from: new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,10), to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10) },
          { label: 'Dieser Monat', from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10), to: new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10) },
        ].map(q => (
          <button key={q.label} onClick={() => { setFrom(q.from); setTo(q.to) }}
            className={from === q.from && to === q.to ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 11, padding: '4px 10px' }}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Ergebnis-Banner */}
      {done && results.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: results.some(r => r.error) ? 'var(--amber-bg)' : 'var(--green-bg)', border: `0.5px solid ${results.some(r => r.error) ? 'var(--amber)' : 'var(--green)'}` }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: results.some(r => r.error) ? 'var(--amber)' : 'var(--green)' }}>
            {results.filter(r => !r.error).length} Honorarnoten erstellt
            {results.filter(r => r.error).length > 0 && ` · ${results.filter(r => r.error).length} Fehler`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.map(r => (
              <div key={r.patientId} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                {r.error
                  ? <><AlertCircle style={{ width: 12, height: 12, color: 'var(--red)', flexShrink: 0 }} />{r.name}: {r.error}</>
                  : <><Check style={{ width: 12, height: 12, color: 'var(--green)', flexShrink: 0 }} />{r.name} · {r.referenceNumber}</>}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader style={{ width: 16, height: 16 }} /> Lade offene Sitzungen...
        </div>
      )}

      {!loading && data && data.patients.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Keine offenen Sitzungen im gewählten Zeitraum.
        </div>
      )}

      {!loading && data && data.patients.length > 0 && (
        <>
          {/* Übersicht */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Patienten', value: data.totalPatients, sub: 'mit offenen Sitzungen' },
              { label: 'Sitzungen', value: data.totalSessions, sub: 'unverrechnete gesamt' },
              { label: 'Betrag Netto', value: fmtEUR(data.totalNet), sub: 'aus allen Sitzungen' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Patienten-Liste */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {selected.size} von {data.patients.length} Patienten ausgewählt · {fmtEUR(selectedTotal)} Netto
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelected(new Set(data.patients.map(e => e.patient.id)))} className="btn-ghost" style={{ fontSize: 12 }}>Alle</button>
              <button onClick={() => setSelected(new Set())} className="btn-ghost" style={{ fontSize: 12 }}>Keine</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.patients.map(entry => {
              const pid     = entry.patient.id
              const checked = selected.has(pid)
              const isOpen  = expanded.has(pid)
              const ov      = overrides[pid] ?? { vatRate: 0, paymentMethod: 'UNBAR_BANK_TRANSFER', markAsPaid: false, generateInvoice: true }
              const vatAmt  = entry.totalNet * ov.vatRate
              const total   = entry.totalNet + vatAmt

              return (
                <div key={pid} style={{ border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-card)' }}>
                  {/* Patient Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const n = new Set(selected)
                        if (e.target.checked) n.add(pid); else n.delete(pid)
                        setSelected(n)
                      }}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {entry.patient.firstName} {entry.patient.lastName}
                        {entry.patient.billRecipientName && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>→ {entry.patient.billRecipientName}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {entry.sessions.length} Sitzung{entry.sessions.length !== 1 ? 'en' : ''} · {PAYMENT_LABELS[ov.paymentMethod]} · MwSt. {Math.round(ov.vatRate*100)}%
                        {ov.markAsPaid && ' · sofort bezahlt'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{fmtEUR(total)}</div>
                      {ov.vatRate > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>inkl. {Math.round(ov.vatRate*100)}% MwSt.</div>}
                    </div>
                    <button onClick={() => {
                      const n = new Set(expanded)
                      if (isOpen) n.delete(pid); else n.add(pid)
                      setExpanded(n)
                    }} className="btn-ghost" style={{ padding: 4, flexShrink: 0 }}>
                      {isOpen ? <ChevronDown style={{ width: 15, height: 15 }} /> : <ChevronRight style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>

                  {/* Aufgeklappt: Sitzungsliste + Overrides */}
                  {isOpen && (
                    <div style={{ borderTop: '0.5px solid var(--border)', padding: '10px 14px', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Sitzungen */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Sitzungen</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {entry.sessions.map((s: any) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', borderBottom: '0.5px solid var(--border)' }}>
                              <span>{s.name} · {fmtDate(s.sessionDate)}</span>
                              <span style={{ fontWeight: 600 }}>{fmtEUR(s.calculatedPriceNet)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Overrides */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Einstellungen (aus Profil, anpassbar)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>MwSt.</div>
                            <select style={{ ...inputStyle, width: '100%' }} value={ov.vatRate}
                              onChange={e => setOverrides(o => ({ ...o, [pid]: { ...ov, vatRate: parseFloat(e.target.value) } }))}>
                              <option value={0}>0 %</option>
                              <option value={0.1}>10 %</option>
                              <option value={0.2}>20 %</option>
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Zahlungsart</div>
                            <select style={{ ...inputStyle, width: '100%' }} value={ov.paymentMethod}
                              onChange={e => setOverrides(o => ({ ...o, [pid]: { ...ov, paymentMethod: e.target.value } }))}>
                              <option value="UNBAR_BANK_TRANSFER">Überweisung</option>
                              <option value="CASH">Bar</option>
                              <option value="CARD_BANKOMAT">Karte</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={ov.markAsPaid}
                              onChange={e => setOverrides(o => ({ ...o, [pid]: { ...ov, markAsPaid: e.target.checked } }))} />
                            Sofort als bezahlt
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={ov.generateInvoice}
                              onChange={e => setOverrides(o => ({ ...o, [pid]: { ...ov, generateInvoice: e.target.checked } }))} />
                            Honorarnote generieren
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Abrechnen-Button */}
          {selected.size > 0 && !done && (
            <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface-page)', padding: '12px 0', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                {selected.size} Patient{selected.size !== 1 ? 'en' : ''} · {fmtEUR(selectedTotal)} Netto
              </div>
              <button onClick={runSammelabrechnung} disabled={running} className="btn-primary" style={{ fontSize: 14, padding: '10px 24px' }}>
                {running
                  ? <><Loader style={{ width: 14, height: 14 }} /> Verarbeite...</>
                  : <><Euro style={{ width: 14, height: 14 }} /> {selected.size} Honorarnote{selected.size !== 1 ? 'n' : ''} erstellen</>}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const inputStyle = { padding: '6px 9px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box' as const }
