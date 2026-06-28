
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Download, TrendingUp, TrendingDown, DollarSign, Car, RefreshCw } from 'lucide-react'

const INCOME_CATS: Record<string,string> = {
  HONORAR: 'Honorare', OTHER_INCOME: 'Sonstige Einnahmen',
}
const EXPENSE_CATS: Record<string,string> = {
  MISC_BUSINESS:'Sonstiger betr. Aufwand', GENERAL:'Allg. Ausgabe',
  SESSION_TRANS:'Sessiontransaktion', CANCELLATION:'Storno',
  CONTINUING_ED:'Fortbildung', THERAPY_TRAINING:'Lehrtherapie',
  TRAVEL:'Reisekosten', OFFICE:'Büroartikel', MARKETING:'Werbung',
  LITERATURE:'Literatur', FEES_TAXES:'Gebühren und Abgaben',
  SVA:'SVA', RENT:'Miete', INSURANCE:'Versicherung', CAR:'Aufwand PKW',
  OPERATIONS:'Betriebskosten', ELECTRICITY:'Strom', PHONE_INTERNET:'Telefon/Internet',
  CLEANING:'Reinigung/Verbrauchsmaterial', PERSONNEL:'Personal',
  SUPERVISION:'Supervision', DAILY_ALLOWANCE:'Taggeld',
  ACCOMMODATION:'Nächtigungsgeld', MILEAGE:'Kilometergeld', DECOR:'Deko',
}
const PAYMENT_METHODS: Record<string,string> = {
  CASH:'Bar', BANK_TRANSFER:'Überweisung', CARD:'Karte', OTHER:'Sonstiges',
}
const PAYMENT_STATUS: Record<string,string> = {
  PENDING:'Ausstehend', PAID:'Bezahlt', OVERDUE:'Überfällig', CANCELLED:'Storniert',
}
const STATUS_CLASS: Record<string,string> = {
  PAID:'badge-green', PENDING:'badge-amber', OVERDUE:'badge-red', CANCELLED:'badge-gray',
}
const TRIP_PURPOSE: Record<string,string> = {
  PATIENT_VISIT:'Hausbesuch', TRAINING:'Fortbildung', SUPERVISION:'Supervision',
  OFFICE:'Büro/Verwaltung', OTHER:'Sonstiges',
}

function fmtEUR(n: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtDate(s: string) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))
}

type Tab = 'overview' | 'income' | 'expenses' | 'mileage' | 'gewinn'

export function FinanceClient() {
  const [tab, setTab] = useState<Tab>('overview')
  const [year, setYear] = useState(new Date().getFullYear())
  const [txs, setTxs] = useState<any[]>([])
  const [miles, setMiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showTxForm, setShowTxForm] = useState(false)
  const [showMileForm, setShowMileForm] = useState(false)
  const [txType, setTxType] = useState<'INCOME'|'EXPENSE'>('INCOME')
  const [txForm, setTxForm] = useState({
    type: 'INCOME', amount: '', date: new Date().toISOString().slice(0,10),
    description: '', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID',
    incomeCategory: 'HONORAR', expenseCategory: 'MISC_BUSINESS', invoiceNumber: '', note: '',
  })
  const [mileForm, setMileForm] = useState({
    date: new Date().toISOString().slice(0,10), departure: '', destination: '',
    purpose: 'OTHER', purposeNote: '', kilometers: '', ratePerKm: '0.42',
  })
  const [savingTx, setSavingTx] = useState(false)
  const [savingMile, setSavingMile] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, mileRes] = await Promise.all([
      fetch(`/api/finance/transactions?year=${year}`).then(r=>r.json()),
      fetch(`/api/finance/mileage?year=${year}`).then(r=>r.json()),
    ])
    setTxs(Array.isArray(txRes) ? txRes : [])
    setMiles(Array.isArray(mileRes) ? mileRes : [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  const income   = txs.filter(t=>t.type==='INCOME')
  const expenses = txs.filter(t=>t.type==='EXPENSE')
  const totalIncome   = income.reduce((s,t)=>s+parseFloat(t.amount),0)
  const totalExpenses = expenses.reduce((s,t)=>s+parseFloat(t.amount),0)
  const totalMileage  = miles.reduce((s,m)=>s+parseFloat(m.totalAmount),0)
  const profit = totalIncome - totalExpenses
  const paidIncome = income.filter(t=>t.paymentStatus==='PAID').reduce((s,t)=>s+parseFloat(t.amount),0)
  const unpaidIncome = income.filter(t=>t.paymentStatus==='PENDING').reduce((s,t)=>s+parseFloat(t.amount),0)
  const grundfreibetrag = profit * 0.15

  async function saveTx() {
    setSavingTx(true)
    const body = {
      ...txForm, type: txType,
      incomeCategory:  txType==='INCOME'  ? txForm.incomeCategory  : null,
      expenseCategory: txType==='EXPENSE' ? txForm.expenseCategory : null,
    }
    await fetch('/api/finance/transactions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    setSavingTx(false); setShowTxForm(false)
    setTxForm({ type:'INCOME', amount:'', date: new Date().toISOString().slice(0,10), description:'', paymentMethod:'BANK_TRANSFER', paymentStatus:'PAID', incomeCategory:'HONORAR', expenseCategory:'MISC_BUSINESS', invoiceNumber:'', note:'' })
    load()
  }

  async function saveMile() {
    setSavingMile(true)
    await fetch('/api/finance/mileage', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(mileForm) })
    setSavingMile(false); setShowMileForm(false)
    setMileForm({ date: new Date().toISOString().slice(0,10), departure:'', destination:'', purpose:'OTHER', purposeNote:'', kilometers:'', ratePerKm:'0.42' })
    load()
  }

  async function deleteTx(id: string) {
    if (!confirm('Transaktion löschen?')) return
    await fetch(`/api/finance/transactions/${id}`, { method: 'DELETE' }); load()
  }
  async function deleteMile(id: string) {
    if (!confirm('Eintrag löschen?')) return
    await fetch(`/api/finance/mileage/${id}`, { method: 'DELETE' }); load()
  }

  function exportCSV(data: any[], filename: string) {
    if (!data.length) return
    const keys = Object.keys(data[0]).filter(k => !['id','createdBy','patientId'].includes(k))
    const csv = [keys.join(';'), ...data.map(r => keys.map(k => JSON.stringify(r[k]??'')).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = filename; a.click()
  }

  const years = Array.from({length: 5}, (_,i) => new Date().getFullYear() - i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Meine Finanzen</h1>
        </div>
        <select value={year} onChange={e=>setYear(+e.target.value)} className="input" style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw style={{ width: 14, height: 14, ...(loading?{animation:'spin 1s linear infinite'}:{}) }} />
        </button>
        <button onClick={() => { setTxType('INCOME'); setShowTxForm(true) }} className="btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Einnahme
        </button>
        <button onClick={() => { setTxType('EXPENSE'); setShowTxForm(true) }} className="btn-secondary">
          <Plus style={{ width: 14, height: 14 }} /> Ausgabe
        </button>
        <button onClick={() => setShowMileForm(true)} className="btn-secondary">
          <Car style={{ width: 14, height: 14 }} /> Fahrt
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '12px 20px 0', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { key: 'overview', label: 'Übersicht' },
            { key: 'income',   label: 'Einnahmen' },
            { key: 'expenses', label: 'Ausgaben' },
            { key: 'mileage',  label: 'Fahrtenbuch' },
            { key: 'gewinn',   label: 'Gewinnermittlung' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as Tab)}
              style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab===t.key ? 600 : 400,
                color: tab===t.key ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: tab===t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, flex: 1 }}>

        {/* ── ÜBERSICHT ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Bezahlte Einnahmen', value: paidIncome, icon: TrendingUp, color: 'var(--green)', bg: 'var(--green-bg)' },
                { label: 'Bezahlte Ausgaben',  value: totalExpenses, icon: TrendingDown, color: 'var(--red)', bg: 'var(--red-bg)' },
                { label: 'Gesamt bezahlt',      value: paidIncome - totalExpenses, icon: DollarSign, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                { label: 'Nicht verrechnet',    value: unpaidIncome, icon: TrendingUp, color: 'var(--amber)', bg: 'var(--amber-bg)' },
              ].map(k => (
                <div key={k.label} className="stat-card">
                  <div className="stat-icon" style={{ background: k.bg }}>
                    <k.icon style={{ width: 16, height: 16, stroke: k.color, fill: 'none' }} />
                  </div>
                  <div className="stat-value" style={{ color: k.color }}>{fmtEUR(k.value)}</div>
                  <div className="stat-label">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Recent transactions */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Letzte Transaktionen</h2>
                <button onClick={() => exportCSV(txs, `finanzen-${year}.csv`)} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Download style={{ width: 13, height: 13 }} /> CSV
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>Datum</th><th>Beschreibung</th><th>Typ</th><th>Status</th><th style={{ textAlign:'right' }}>Betrag</th><th></th></tr></thead>
                <tbody>
                  {txs.slice(0,20).map(t => (
                    <tr key={t.id}>
                      <td>{fmtDate(t.date)}</td>
                      <td className="primary">{t.description||t.incomeCategory||t.expenseCategory}</td>
                      <td><span className={t.type==='INCOME'?'badge badge-green':'badge badge-red'}>{t.type==='INCOME'?'Einnahme':'Ausgabe'}</span></td>
                      <td><span className={'badge '+STATUS_CLASS[t.paymentStatus]}>{PAYMENT_STATUS[t.paymentStatus]}</span></td>
                      <td style={{ textAlign:'right', fontWeight:600, color: t.type==='INCOME'?'var(--green)':'var(--red)' }}>
                        {t.type==='INCOME'?'+':'-'}{fmtEUR(parseFloat(t.amount))}
                      </td>
                      <td><button onClick={()=>deleteTx(t.id)} className="btn-ghost" style={{padding:'2px 4px'}}><Trash2 style={{width:12,height:12}} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EINNAHMEN ── */}
        {tab === 'income' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Einnahmen {year} — {fmtEUR(totalIncome)}</h2>
              <button onClick={() => exportCSV(income, `einnahmen-${year}.csv`)} className="btn-secondary" style={{ fontSize:12 }}><Download style={{width:13,height:13}} /> CSV</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Datum</th><th>Kategorie</th><th>Beschreibung</th><th>Methode</th><th>Status</th><th>Belegnr.</th><th style={{textAlign:'right'}}>Betrag</th><th></th></tr></thead>
              <tbody>
                {income.map(t => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td><span className="badge badge-indigo">{INCOME_CATS[t.incomeCategory]??t.incomeCategory}</span></td>
                    <td>{t.description||'—'}</td>
                    <td>{PAYMENT_METHODS[t.paymentMethod]}</td>
                    <td><span className={'badge '+STATUS_CLASS[t.paymentStatus]}>{PAYMENT_STATUS[t.paymentStatus]}</span></td>
                    <td>{t.invoiceNumber||'—'}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--green)'}}>{fmtEUR(parseFloat(t.amount))}</td>
                    <td><button onClick={()=>deleteTx(t.id)} className="btn-ghost" style={{padding:'2px 4px'}}><Trash2 style={{width:12,height:12}} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AUSGABEN ── */}
        {tab === 'expenses' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Ausgaben {year} — {fmtEUR(totalExpenses)}</h2>
              <button onClick={() => exportCSV(expenses, `ausgaben-${year}.csv`)} className="btn-secondary" style={{ fontSize:12 }}><Download style={{width:13,height:13}} /> CSV</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Datum</th><th>Kategorie</th><th>Beschreibung</th><th>Methode</th><th>Status</th><th style={{textAlign:'right'}}>Betrag</th><th></th></tr></thead>
              <tbody>
                {expenses.map(t => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td><span className="badge badge-red">{EXPENSE_CATS[t.expenseCategory]??t.expenseCategory}</span></td>
                    <td>{t.description||'—'}</td>
                    <td>{PAYMENT_METHODS[t.paymentMethod]}</td>
                    <td><span className={'badge '+STATUS_CLASS[t.paymentStatus]}>{PAYMENT_STATUS[t.paymentStatus]}</span></td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--red)'}}>{fmtEUR(parseFloat(t.amount))}</td>
                    <td><button onClick={()=>deleteTx(t.id)} className="btn-ghost" style={{padding:'2px 4px'}}><Trash2 style={{width:12,height:12}} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FAHRTENBUCH ── */}
        {tab === 'mileage' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Fahrtenbuch {year}</h2>
                <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--text-muted)' }}>
                  {miles.reduce((s,m)=>s+parseFloat(m.kilometers),0).toFixed(1)} km · {fmtEUR(totalMileage)}
                </p>
              </div>
              <button onClick={() => exportCSV(miles, `fahrtenbuch-${year}.csv`)} className="btn-secondary" style={{ fontSize:12 }}><Download style={{width:13,height:13}} /> CSV</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Datum</th><th>Von</th><th>Nach</th><th>Zweck</th><th>km</th><th>€/km</th><th style={{textAlign:'right'}}>Betrag</th><th></th></tr></thead>
              <tbody>
                {miles.map(m => (
                  <tr key={m.id}>
                    <td>{fmtDate(m.date)}</td>
                    <td>{m.departure}</td>
                    <td>{m.destination}</td>
                    <td><span className="badge badge-indigo">{TRIP_PURPOSE[m.purpose]}</span>{m.purposeNote && <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:4}}>{m.purposeNote}</span>}</td>
                    <td>{parseFloat(m.kilometers).toFixed(1)}</td>
                    <td>{parseFloat(m.ratePerKm).toFixed(2)}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--color-primary)'}}>{fmtEUR(parseFloat(m.totalAmount))}</td>
                    <td><button onClick={()=>deleteMile(m.id)} className="btn-ghost" style={{padding:'2px 4px'}}><Trash2 style={{width:12,height:12}} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── GEWINNERMITTLUNG ── */}
        {tab === 'gewinn' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Einnahmen nach Kategorie */}
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>Betriebseinnahmen</h2>
              {Object.entries(INCOME_CATS).map(([k,label]) => {
                const sum = income.filter(t=>t.incomeCategory===k).reduce((s,t)=>s+parseFloat(t.amount),0)
                return sum > 0 ? (
                  <div key={k} className="field-row">
                    <span className="field-label">{label}</span>
                    <span className="field-value">{fmtEUR(sum)}</span>
                  </div>
                ) : null
              })}
              <div className="field-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Zwischensumme Einnahmen</span>
                <span style={{ fontSize:14, fontWeight:700, color:'var(--green)' }}>{fmtEUR(totalIncome)}</span>
              </div>
            </div>

            {/* Ausgaben nach Kategorie */}
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>Ausgaben</h2>
              {Object.entries(EXPENSE_CATS).map(([k,label]) => {
                const sum = expenses.filter(t=>t.expenseCategory===k).reduce((s,t)=>s+parseFloat(t.amount),0)
                return sum > 0 ? (
                  <div key={k} className="field-row">
                    <span className="field-label">{label}</span>
                    <span className="field-value" style={{ color:'var(--red)' }}>-{fmtEUR(sum)}</span>
                  </div>
                ) : null
              })}
              {totalMileage > 0 && (
                <div className="field-row">
                  <span className="field-label">Kilometergeld (Fahrtenbuch)</span>
                  <span className="field-value" style={{ color:'var(--red)' }}>-{fmtEUR(totalMileage)}</span>
                </div>
              )}
              <div className="field-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Zwischensumme Ausgaben</span>
                <span style={{ fontSize:14, fontWeight:700, color:'var(--red)' }}>-{fmtEUR(totalExpenses + totalMileage)}</span>
              </div>
            </div>

            {/* Ergebnis */}
            <div className="card" style={{ padding: 20, gridColumn: '1/-1' }}>
              <div className="field-row" style={{ paddingBottom: 12 }}>
                <span style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>Gewinn {year}</span>
                <span style={{ fontSize:20, fontWeight:800, color: profit>=0?'var(--green)':'var(--red)' }}>{fmtEUR(profit)}</span>
              </div>
              <div className="field-row">
                <span className="field-label">Grundfreibetrag 15% vom Gewinn</span>
                <span className="field-value" style={{ color:'var(--red)' }}>-{fmtEUR(grundfreibetrag)}</span>
              </div>
              <div className="field-row">
                <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Einkünfte aus Gewerbebetrieb/selbständiger Arbeit</span>
                <span style={{ fontSize:15, fontWeight:700, color:'var(--color-primary)' }}>{fmtEUR(Math.max(0, profit - grundfreibetrag))}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}

      {/* Transaktion */}
      {showTxForm && (
        <div className="modal-overlay" onClick={() => setShowTxForm(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <h2 style={{ margin:0, fontSize:15 }}>{txType==='INCOME' ? 'Einnahme' : 'Ausgabe'} erfassen</h2>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>setTxType('INCOME')} className={txType==='INCOME'?'btn-primary':'btn-secondary'} style={{fontSize:12,padding:'3px 10px'}}>Einnahme</button>
                  <button onClick={()=>setTxType('EXPENSE')} className={txType==='EXPENSE'?'btn-primary':'btn-secondary'} style={{fontSize:12,padding:'3px 10px'}}>Ausgabe</button>
                </div>
              </div>
              <button onClick={() => setShowTxForm(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}} /></button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-grid-2">
                <div><label className="label">Betrag (€) *</label><input type="number" step="0.01" className="input" placeholder="0.00" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} /></div>
                <div><label className="label">Datum *</label><input type="date" className="input" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} /></div>
              </div>
              <div><label className="label">Kategorie *</label>
                <select className="input" value={txType==='INCOME'?txForm.incomeCategory:txForm.expenseCategory}
                  onChange={e => txType==='INCOME' ? setTxForm(f=>({...f,incomeCategory:e.target.value})) : setTxForm(f=>({...f,expenseCategory:e.target.value}))}>
                  {Object.entries(txType==='INCOME'?INCOME_CATS:EXPENSE_CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Beschreibung</label><input className="input" value={txForm.description} onChange={e=>setTxForm(f=>({...f,description:e.target.value}))} /></div>
              <div className="form-grid-2">
                <div><label className="label">Zahlungsmethode</label>
                  <select className="input" value={txForm.paymentMethod} onChange={e=>setTxForm(f=>({...f,paymentMethod:e.target.value}))}>
                    {Object.entries(PAYMENT_METHODS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="label">Status</label>
                  <select className="input" value={txForm.paymentStatus} onChange={e=>setTxForm(f=>({...f,paymentStatus:e.target.value}))}>
                    {Object.entries(PAYMENT_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Belegnummer</label><input className="input" placeholder="Rech-2026-001" value={txForm.invoiceNumber} onChange={e=>setTxForm(f=>({...f,invoiceNumber:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowTxForm(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={saveTx} disabled={savingTx||!txForm.amount||!txForm.date} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {savingTx?'Speichern...':'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fahrt */}
      {showMileForm && (
        <div className="modal-overlay" onClick={() => setShowMileForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{margin:0,fontSize:15}}>Fahrt erfassen</h2><button onClick={()=>setShowMileForm(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}} /></button></div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label className="label">Datum *</label><input type="date" className="input" value={mileForm.date} onChange={e=>setMileForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-grid-2">
                <div><label className="label">Abfahrtsort *</label><input className="input" placeholder="St. Stefan" value={mileForm.departure} onChange={e=>setMileForm(f=>({...f,departure:e.target.value}))} /></div>
                <div><label className="label">Zielort *</label><input className="input" placeholder="Klagenfurt" value={mileForm.destination} onChange={e=>setMileForm(f=>({...f,destination:e.target.value}))} /></div>
              </div>
              <div className="form-grid-2">
                <div><label className="label">Kilometer *</label><input type="number" step="0.1" className="input" placeholder="45.5" value={mileForm.kilometers} onChange={e=>setMileForm(f=>({...f,kilometers:e.target.value}))} /></div>
                <div><label className="label">€/km</label><input type="number" step="0.01" className="input" value={mileForm.ratePerKm} onChange={e=>setMileForm(f=>({...f,ratePerKm:e.target.value}))} /></div>
              </div>
              <div><label className="label">Zweck</label>
                <select className="input" value={mileForm.purpose} onChange={e=>setMileForm(f=>({...f,purpose:e.target.value}))}>
                  {Object.entries(TRIP_PURPOSE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Beschreibung</label><input className="input" placeholder="z.B. Hausbesuch Patient Muster" value={mileForm.purposeNote} onChange={e=>setMileForm(f=>({...f,purposeNote:e.target.value}))} /></div>
              {mileForm.kilometers && mileForm.ratePerKm && (
                <div style={{ padding:'10px 12px', background:'var(--color-primary-light)', borderRadius:8, fontSize:13, color:'var(--color-primary)', fontWeight:600 }}>
                  Betrag: {fmtEUR(parseFloat(mileForm.kilometers) * parseFloat(mileForm.ratePerKm))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowMileForm(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={saveMile} disabled={savingMile||!mileForm.kilometers||!mileForm.departure} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {savingMile?'Speichern...':'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
