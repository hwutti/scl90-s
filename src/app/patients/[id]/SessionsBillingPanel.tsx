
'use client'
import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Plus, X, ChevronRight, Check, Clock, AlertCircle, Edit3, Euro, 
         FileText, Euro, Trash2, Eye, Download, RotateCcw, Ban } from 'lucide-react'

const BILLING_STATUS_LABEL: Record<string,string> = {
  UNBILLED: 'Nicht verrechnet', BILLED_UNPAID: 'Verrechnet (offen)',
  PAID: 'Bezahlt', EXCLUDED: 'Ausgeschlossen',
}
const BILLING_STATUS_CLASS: Record<string,string> = {
  UNBILLED: 'badge-gray', BILLED_UNPAID: 'badge-amber',
  PAID: 'badge-green', EXCLUDED: 'badge-gray',
}
const PAYMENT_METHODS: Record<string,string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung', CASH: 'Bar',
  CASH_HELLOCASH: 'Bar (HelloCash)', CARD_BANKOMAT: 'Karte/Bankomat', UNKNOWN: 'Unbekannt',
}

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtEUR(n: number | string | null | undefined) {
  if (!n) return '—'
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n.toString()))
}
function fmtMins(m: number | null | undefined) {
  if (!m) return '—'
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60}min` : `${m} min`
}

export function SessionsBillingPanel({ patientId, role }: { patientId: string; role: string }) {
  const [sessions, setSessions] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'sessions'|'transactions'>('sessions')
  const [showNewSession, setShowNewSession] = useState(false)
  const [showCreateTx, setShowCreateTx] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [showInvoice, setShowInvoice] = useState<any>(null)
  const [payingTxId, setPayingTxId] = useState<string|null>(null)
  const [undoCountdown, setUndoCountdown] = useState<Record<string,number>>({})

  const [newSession, setNewSession] = useState({
    sessionDate: new Date().toISOString().slice(0,10),
    durationMinutes: 50,
    billingMode: 'time',
    hourlyRateNet: 120,
    unitCount: 1,
    unitPriceNet: 120,
    serviceLabel: 'Psychotherapeutische Behandlung',
  })
  const [txForm, setTxForm] = useState({
    payerName: '', vatRate: 0, markAsPaid: false,
    paymentMethod: 'UNBAR_BANK_TRANSFER', notes: '', paymentInfo: '',
  })
  const [savingSession, setSavingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string|null>(null)
  const [detailSession, setDetailSession] = useState<any>(null)
  const [savingTx, setSavingTx] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, tRes] = await Promise.all([
      fetch(`/api/patients/${patientId}/sessions`).then(r=>r.json()),
      fetch(`/api/transactions?patientId=${patientId}`).then(r=>r.json()),
    ])
    setSessions(Array.isArray(sRes) ? sRes : [])
    setTransactions(Array.isArray(tRes) ? tRes : [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Countdown für Zahlung-Undo
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const updated: Record<string,number> = {}
      for (const tx of transactions) {
        if (tx.paymentUndoDeadline && tx.paymentStatus === 'PAID') {
          const remaining = Math.max(0, Math.ceil((new Date(tx.paymentUndoDeadline).getTime() - now) / 1000))
          updated[tx.id] = remaining
        }
      }
      setUndoCountdown(updated)
    }, 1000)
    return () => clearInterval(interval)
  }, [transactions])

  async function createSession() {
    setSavingSession(true)
    setSessionError(null)
    try {
      const res = await fetch('/api/therapy-sessions', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...newSession, patientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSessionError(data.error ?? 'Fehler beim Speichern')
        setSavingSession(false)
        return
      }
      setSavingSession(false)
      setShowNewSession(false)
      setSessionError(null)
      load()
    } catch (e: any) {
      setSessionError(e.message ?? 'Netzwerkfehler')
      setSavingSession(false)
    }
  }

  async function createTransaction() {
    if (!selectedSessions.length) return
    setSavingTx(true)
    // Get patient name for payer
    const patientSession = sessions.find(s => s.patient)
    const payeeName = 'Psychotherapeutische Praxis' // from branding ideally
    await fetch('/api/transactions/from-sessions', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        sessionIds: selectedSessions,
        patientId,
        payerName: txForm.payerName || (patientSession?.patient ? `${patientSession.patient.firstName} ${patientSession.patient.lastName}` : 'Patient'),
        payeeName,
        vatRate: txForm.vatRate / 100,
        markAsPaid: txForm.markAsPaid,
        paymentMethod: txForm.paymentMethod,
        notes: txForm.notes,
      }),
    })
    setSavingTx(false); setShowCreateTx(false); setSelectedSessions([]); load()
  }

  async function markPaid(txId: string) {
    await fetch(`/api/transactions/${txId}/mark-paid`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ paymentMethod: 'UNBAR_BANK_TRANSFER' }),
    })
    load()
  }

  async function undoPayment(txId: string) {
    await fetch(`/api/transactions/${txId}/undo-payment`, { method: 'POST' })
    load()
  }

  async function cancelTx(txId: string) {
    if (!confirm('Transaktion wirklich stornieren? Es wird eine Gegenbuchung erstellt.')) return
    await fetch(`/api/transactions/${txId}/cancel`, { method: 'POST' })
    load()
  }

  async function generateInvoice(txId: string) {
    const res = await fetch(`/api/transactions/${txId}/invoice`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ paymentInfo: txForm.paymentInfo }),
    })
    const data = await res.json()
    setShowInvoice({ txId, html: data.html, id: data.id })
    load()
  }

  const unbilledSessions = sessions.filter(s => s.billingStatus === 'UNBILLED')
  const totalUnbilled = unbilledSessions.reduce((s: number, session: any) =>
    s + parseFloat(session.calculatedPriceNet ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Sitzungen gesamt', value: sessions.length, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
          { label: 'Nicht verrechnet', value: unbilledSessions.length, color: 'var(--amber)', bg: 'var(--amber-bg)' },
          { label: 'Offener Betrag', value: fmtEUR(totalUnbilled), color: 'var(--red)', bg: 'var(--red-bg)' },
          { label: 'Transaktionen', value: transactions.length, color: 'var(--green)', bg: 'var(--green-bg)' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-icon" style={{ background: k.bg }}>
              <Euro style={{ width: 15, height: 15, stroke: k.color, fill: 'none' }} />
            </div>
            <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            <div className="stat-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 0 }}>
        {[['sessions','Sitzungen'],['transactions','Transaktionen']].map(([key,label]) => (
          <button key={key} onClick={() => setSelectedTab(key as any)}
            style={{ padding: '7px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: selectedTab===key ? 600 : 400,
              color: selectedTab===key ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: selectedTab===key ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SESSIONS ── */}
      {selectedTab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedSessions.length > 0 && (
                <button onClick={() => setShowCreateTx(true)} className="btn-primary">
                  <Euro style={{ width: 13, height: 13 }} /> Transaktion erstellen ({selectedSessions.length})
                </button>
              )}
            </div>
            <button onClick={() => setShowNewSession(true)} className="btn-primary">
              <Plus style={{ width: 13, height: 13 }} /> Neue Sitzung
            </button>
          </div>

          {loading ? <div className="empty-state"><div className="spinner" style={{width:24,height:24}}/></div> :
          sessions.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <div className="empty-state">
                <ClipboardList className="empty-state-icon" style={{width:36,height:36}}/>
                <p className="empty-state-text">Noch keine Sitzungen erfasst.</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr>
                  <th style={{width:30}}></th>
                  <th>Sitzung</th><th>Datum</th><th>Dauer</th>
                  <th>Betrag</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {sessions.map((s: any) => (
                    <tr key={s.id} style={{cursor:'pointer'}}
                      onClick={() => setDetailSession(s)}>
                      <td onClick={e => e.stopPropagation()}>
                        {s.billingStatus === 'UNBILLED' && (
                          <input type="checkbox" checked={selectedSessions.includes(s.id)}
                            onChange={e => setSelectedSessions(prev =>
                              e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                            style={{cursor:'pointer'}} />
                        )}
                      </td>
                      <td className="primary">{s.name}</td>
                      <td>{fmtDate(s.sessionDate)}</td>
                      <td>{fmtMins(s.durationMinutes)}</td>
                      <td style={{fontWeight:600,color:'var(--color-primary)'}}>{fmtEUR(s.calculatedPriceNet)}</td>
                      <td><span className={'badge '+BILLING_STATUS_CLASS[s.billingStatus]}>{BILLING_STATUS_LABEL[s.billingStatus]}</span></td>
                      <td style={{display:'flex',gap:4,alignItems:'center'}}>
                        {s.protocols?.some((p:any) => p.type === 'SHORT') &&
                          <span className="badge badge-indigo" style={{fontSize:10}}>Protokoll</span>}
                        {s._count?.audioRecordings > 0 &&
                          <span className="badge badge-blue" style={{fontSize:10}}>🎙 Audio</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSAKTIONEN ── */}
      {selectedTab === 'transactions' && (
        <div>
          {loading ? <div className="empty-state"><div className="spinner" style={{width:24,height:24}}/></div> :
          transactions.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <div className="empty-state">
                <Euro className="empty-state-icon" style={{width:36,height:36}}/>
                <p className="empty-state-text">Noch keine Transaktionen.</p>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {transactions.map((tx: any) => (
                <div key={tx.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'var(--color-primary)' }}>
                          {tx.referenceNumber}
                        </span>
                        <span className={tx.paymentStatus==='PAID'?'badge badge-green':'badge badge-amber'}>
                          {tx.paymentStatus==='PAID'?'Bezahlt':'Offen'}
                        </span>
                        {tx.lifecycleStatus === 'CANCELLED_ORIGINAL' && <span className="badge badge-red">Storniert</span>}
                        {tx.lifecycleStatus === 'CANCELLATION_TX' && <span className="badge badge-gray">Storno</span>}
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-secondary)', display:'flex', gap:16, flexWrap:'wrap' }}>
                        <span>{fmtDate(tx.transactionDate)}</span>
                        <span style={{fontWeight:600}}>{fmtEUR(tx.amountGross)}</span>
                        <span style={{color:'var(--text-muted)'}}>{tx.payerName}</span>
                        {tx.paymentMethod && <span style={{color:'var(--text-muted)'}}>{PAYMENT_METHODS[tx.paymentMethod]}</span>}
                      </div>
                      {/* 5-Minuten Undo Countdown */}
                      {undoCountdown[tx.id] > 0 && (
                        <div style={{ marginTop:6, padding:'4px 10px', background:'var(--amber-bg)', borderRadius:6, fontSize:12, color:'var(--amber)' }}>
                          Zahlung rückgängig möglich noch {undoCountdown[tx.id]}s
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                      {tx.paymentStatus === 'UNPAID' && tx.lifecycleStatus === 'ACTIVE' && (
                        <button onClick={() => markPaid(tx.id)} className="btn-secondary" style={{fontSize:12,padding:'4px 10px'}}>
                          <Check style={{width:12,height:12}} /> Bezahlt
                        </button>
                      )}
                      {undoCountdown[tx.id] > 0 && (
                        <button onClick={() => undoPayment(tx.id)} className="btn-danger" style={{fontSize:12,padding:'4px 10px'}}>
                          <RotateCcw style={{width:12,height:12}} /> Rückgängig
                        </button>
                      )}
                      <button onClick={() => generateInvoice(tx.id)} className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} title="Rechnung generieren">
                        <FileText style={{width:13,height:13}} />
                      </button>
                      {tx.lifecycleStatus === 'ACTIVE' && (
                        <button onClick={() => cancelTx(tx.id)} className="btn-danger" style={{fontSize:12,padding:'4px 8px'}} title="Stornieren">
                          <Ban style={{width:13,height:13}} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Invoice Docs */}
                  {tx.invoiceDocuments?.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                      {tx.invoiceDocuments.map((doc: any) => (
                        <button key={doc.id} onClick={() => generateInvoice(tx.id)} className="btn-secondary" style={{fontSize:11,padding:'2px 8px'}}>
                          <FileText style={{width:11,height:11}} /> Rechnung {new Date(doc.createdAt).toLocaleDateString('de-AT')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* Neue Sitzung */}
      {showNewSession && (
        <div className="modal-overlay" onClick={() => setShowNewSession(false)}>
          <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Neue Sitzung erfassen</h2>
              <button onClick={()=>setShowNewSession(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              {sessionError && (
                <div style={{padding:'8px 12px',background:'var(--red-bg)',border:'0.5px solid var(--red-border)',borderRadius:8,color:'var(--red)',fontSize:13}}>
                  {sessionError}
                </div>
              )}
              <div className="form-grid-2">
                <div><label className="label">Datum *</label>
                  <input type="date" className="input" value={newSession.sessionDate}
                    onChange={e=>setNewSession(s=>({...s,sessionDate:e.target.value}))} />
                </div>
                <div><label className="label">Dauer (Min.)</label>
                  <input type="number" className="input" value={newSession.durationMinutes}
                    onChange={e=>setNewSession(s=>({...s,durationMinutes:+e.target.value}))} />
                </div>
              </div>
              <div><label className="label">Abrechnungsmodus</label>
                <div style={{display:'flex',gap:8}}>
                  {[['time','Zeit'],['unit','Einheiten']].map(([v,l]) => (
                    <button key={v} onClick={()=>setNewSession(s=>({...s,billingMode:v}))}
                      className={newSession.billingMode===v?'btn-primary':'btn-secondary'} style={{flex:1}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {newSession.billingMode === 'time' ? (
                <div><label className="label">Stundensatz (€/h)</label>
                  <input type="number" step="0.01" className="input" value={newSession.hourlyRateNet}
                    onChange={e=>setNewSession(s=>({...s,hourlyRateNet:+e.target.value}))} />
                  <p style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
                    Preis: € {((newSession.durationMinutes/60)*newSession.hourlyRateNet).toFixed(2)}
                  </p>
                </div>
              ) : (
                <div className="form-grid-2">
                  <div><label className="label">Einheiten</label>
                    <input type="number" step="0.5" className="input" value={newSession.unitCount}
                      onChange={e=>setNewSession(s=>({...s,unitCount:+e.target.value}))} />
                  </div>
                  <div><label className="label">€ / Einheit</label>
                    <input type="number" step="0.01" className="input" value={newSession.unitPriceNet}
                      onChange={e=>setNewSession(s=>({...s,unitPriceNet:+e.target.value}))} />
                  </div>
                </div>
              )}
              <div><label className="label">Dienstleistungsbezeichnung</label>
                <input className="input" value={newSession.serviceLabel}
                  onChange={e=>setNewSession(s=>({...s,serviceLabel:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowNewSession(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={createSession} disabled={savingSession||!newSession.sessionDate} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {savingSession?'Speichern...':'Sitzung speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaktion erstellen */}
      {showCreateTx && (
        <div className="modal-overlay" onClick={() => setShowCreateTx(false)}>
          <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Transaktion erstellen</h2>
              <button onClick={()=>setShowCreateTx(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Summary */}
              <div style={{padding:'10px 14px',background:'var(--color-primary-light)',borderRadius:8}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--color-primary)',margin:'0 0 4px'}}>
                  {selectedSessions.length} Sitzung(en) ausgewählt
                </p>
                <p style={{fontSize:13,color:'var(--text-primary)',margin:0}}>
                  Gesamtbetrag: <strong>
                    {fmtEUR(sessions.filter(s=>selectedSessions.includes(s.id))
                      .reduce((sum:number,s:any)=>sum+parseFloat(s.calculatedPriceNet??0),0))}
                  </strong>
                </p>
              </div>
              <div><label className="label">Zahler (Name) *</label>
                <input className="input" placeholder="Vor- und Nachname des Zahlers"
                  value={txForm.payerName} onChange={e=>setTxForm(f=>({...f,payerName:e.target.value}))} />
              </div>
              <div className="form-grid-2">
                <div><label className="label">MwSt. %</label>
                  <select className="input" value={txForm.vatRate} onChange={e=>setTxForm(f=>({...f,vatRate:+e.target.value}))}>
                    <option value={0}>0% (keine MwSt.)</option>
                    <option value={20}>20%</option>
                    <option value={10}>10%</option>
                  </select>
                </div>
                <div><label className="label">Zahlungsmethode</label>
                  <select className="input" value={txForm.paymentMethod} onChange={e=>setTxForm(f=>({...f,paymentMethod:e.target.value}))}>
                    {Object.entries(PAYMENT_METHODS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--surface-panel)',borderRadius:8}}>
                <input type="checkbox" id="markPaid" checked={txForm.markAsPaid}
                  onChange={e=>setTxForm(f=>({...f,markAsPaid:e.target.checked}))} />
                <label htmlFor="markPaid" style={{fontSize:13,cursor:'pointer',color:'var(--text-primary)'}}>
                  Sofort als bezahlt markieren
                </label>
              </div>
              <div><label className="label">Zahlungsinformationen (für Rechnung)</label>
                <textarea className="input" rows={2} placeholder="IBAN: AT... · BIC: ..."
                  value={txForm.paymentInfo} onChange={e=>setTxForm(f=>({...f,paymentInfo:e.target.value}))} style={{resize:'vertical'}}/>
              </div>
              <div><label className="label">Notiz</label>
                <input className="input" value={txForm.notes} onChange={e=>setTxForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowCreateTx(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={createTransaction} disabled={savingTx||!txForm.payerName} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {savingTx?'Erstelle...':'Transaktion erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sitzungsdetail Modal */}
      {detailSession && (
        <div className="modal-overlay" onClick={() => setDetailSession(null)}>
          <div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>{detailSession.name}</h2>
              <button onClick={()=>setDetailSession(null)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                ['Datum', fmtDate(detailSession.sessionDate)],
                ['Dauer', detailSession.durationMinutes ? detailSession.durationMinutes + ' Min.' : '—'],
                ['Abrechnungsmodus', detailSession.billingMode === 'time' ? 'Zeit' : 'Einheiten'],
                ['Betrag', fmtEUR(detailSession.calculatedPriceNet)],
                ['Dienstleistung', detailSession.serviceLabel || '—'],
                ['Status', BILLING_STATUS_LABEL[detailSession.billingStatus] ?? detailSession.billingStatus],
              ].map(([label, value]) => (
                <div key={label} className="field-row">
                  <span className="field-label">{label}</span>
                  <span className="field-value">{value}</span>
                </div>
              ))}
              {detailSession.billingStatus === 'UNBILLED' && (
                <div style={{paddingTop:8,borderTop:'0.5px solid var(--border)'}}>
                  <button onClick={() => {
                    setSelectedSessions([detailSession.id])
                    setDetailSession(null)
                    setShowCreateTx(true)
                  }} className="btn-primary" style={{width:'100%',justifyContent:'center'}}>
                    <Euro style={{width:13,height:13}}/> Transaktion für diese Sitzung erstellen
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={()=>setDetailSession(null)} className="btn-secondary" style={{flex:1}}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Rechnungsvorschau */}
      {showInvoice && (
        <div className="modal-overlay" onClick={()=>setShowInvoice(null)}>
          <div className="modal" style={{maxWidth:900,maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Rechnungsvorschau</h2>
              <div style={{display:'flex',gap:8}}>
                <button onClick={() => {
                  const blob = new Blob([showInvoice.html], {type:'text/html'})
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href=url; a.download='rechnung.html'; a.click()
                }} className="btn-secondary" style={{fontSize:12}}>
                  <Download style={{width:13,height:13}}/> Download HTML
                </button>
                <button onClick={()=>window.print()} className="btn-secondary" style={{fontSize:12}}>
                  <FileText style={{width:13,height:13}}/> Drucken/PDF
                </button>
                <button onClick={()=>setShowInvoice(null)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
              </div>
            </div>
            <div style={{padding:16,maxHeight:'75vh',overflow:'auto'}}>
              <iframe srcDoc={showInvoice.html} style={{width:'100%',height:600,border:'none',borderRadius:8}} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
