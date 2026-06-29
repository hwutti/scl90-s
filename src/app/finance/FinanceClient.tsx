'use client'
import { useState, useEffect, useCallback } from 'react'
import { SammelabrechungPanel } from './SammelabrechungPanel'
import {
  Plus, X, Trash2, Download, TrendingUp, TrendingDown, DollarSign,
  Car, RefreshCw, FileText, Check, RotateCcw, Ban, Search,
  ChevronDown, AlertCircle, Info, Edit3, Receipt
} from 'lucide-react'

// ── Labels & Konstanten ──────────────────────────────────────────────────────

const INCOME_CATS: Record<string,string> = {
  HONORAR: 'Honorare', OTHER_INCOME: 'Sonstige Einnahmen',
}
const EXPENSE_CATS: Record<string,string> = {
  MISC_BUSINESS:'Sonstiger betr. Aufwand', GENERAL:'Allg. Ausgabe',
  SESSION_TRANS:'Sitzungstransaktion', CANCELLATION:'Storno',
  CONTINUING_ED:'Fortbildung', THERAPY_TRAINING:'Lehrtherapie',
  TRAVEL:'Reisekosten', OFFICE:'Büroartikel', MARKETING:'Werbung',
  LITERATURE:'Literatur', FEES_TAXES:'Gebühren und Abgaben',
  SVA:'SVA', RENT:'Miete', INSURANCE:'Versicherung', CAR:'Aufwand PKW',
  OPERATIONS:'Betriebskosten', ELECTRICITY:'Strom', PHONE_INTERNET:'Telefon/Internet',
  CLEANING:'Reinigung/Verbrauchsmaterial', PERSONNEL:'Personal',
  SUPERVISION:'Supervision', DAILY_ALLOWANCE:'Taggeld',
  ACCOMMODATION:'Nächtigungsgeld', MILEAGE:'Kilometergeld', DECOR:'Deko',
}
const TX_PAYMENT_METHODS: Record<string,string> = {
  UNBAR_BANK_TRANSFER:'Überweisung', CASH:'Bar',
  CASH_HELLOCASH:'Bar (HelloCash)', CARD_BANKOMAT:'Karte/Bankomat', UNKNOWN:'Unbekannt',
}
const LEGACY_PAYMENT_METHODS: Record<string,string> = {
  CASH:'Bar', BANK_TRANSFER:'Überweisung', CARD:'Karte', OTHER:'Sonstiges',
}
const TRIP_PURPOSE: Record<string,string> = {
  PATIENT_VISIT:'Hausbesuch', TRAINING:'Fortbildung', SUPERVISION:'Supervision',
  OFFICE:'Büro/Verwaltung', OTHER:'Sonstiges',
}

function fmtEUR(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === '') return '€ —'
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n.toString()))
}
function fmtDate(s: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))
}

type MainTab = 'overview' | 'income' | 'expenses' | 'mileage' | 'gewinn' | 'sammelabrechnung'

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

export function FinanceClient() {
  const [tab, setTab]   = useState<MainTab>('overview')
  const [year, setYear] = useState(new Date().getFullYear())

  // Daten
  const [newTxs,   setNewTxs]   = useState<any[]>([])   // Transaction-Tabelle
  const [legacyTxs, setLegacyTxs] = useState<any[]>([]) // FinanceTransaction-Tabelle
  const [miles,    setMiles]    = useState<any[]>([])
  const [profit,   setProfit]   = useState<any>(null)
  const [loading,  setLoading]  = useState(false)

  // Suche
  const [incomeSearch,  setIncomeSearch]  = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')

  // Detail-Panel
  const [detailTx, setDetailTx] = useState<any>(null)

  // Modals
  const [showManualTx,  setShowManualTx]  = useState(false)
  const [showMileForm,  setShowMileForm]  = useState(false)
  const [showWizard,    setShowWizard]    = useState(false)  // 4-Schritt-Wizard

  // Manuelle Rechnung
  const [manualDir, setManualDir] = useState<'INCOME'|'EXPENSE'>('EXPENSE')
  const [manualForm, setManualForm] = useState({
    payerName: '', payerAddress: '', payeeName: '', payeeAddress: '',
    amountNet: '', vatRate: 0, date: new Date().toISOString().slice(0,10),
    paid: true, paidAt: new Date().toISOString().slice(0,10),
    paymentMethod: 'UNBAR_BANK_TRANSFER', notes: '',
    // Legacy-Felder für einfache Kategorisierung
    expenseCategory: 'MISC_BUSINESS', incomeCategory: 'HONORAR',
  })
  const [savingManual, setSavingManual] = useState(false)

  // Fahrt
  const [mileForm, setMileForm] = useState({
    date: new Date().toISOString().slice(0,10), departure: '', destination: '',
    purpose: 'OTHER', purposeNote: '', kilometers: '', ratePerKm: '0.42', returnTrip: false,
  })
  const [savingMile, setSavingMile] = useState(false)

  // ── Daten laden ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, legRes, mileRes, profitRes] = await Promise.all([
      fetch(`/api/transactions?year=${year}`).then(r => r.json()),
      fetch(`/api/finance/transactions?year=${year}`).then(r => r.json()),
      fetch(`/api/finance/mileage?year=${year}`).then(r => r.json()),
      fetch(`/api/finance/profit-statement?year=${year}`).then(r => r.json()),
    ])
    setNewTxs(Array.isArray(txRes) ? txRes : [])
    setLegacyTxs(Array.isArray(legRes) ? legRes : [])
    setMiles(Array.isArray(mileRes) ? mileRes : [])
    setProfit(profitRes)
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  // ── Berechnungen ───────────────────────────────────────────────────────────

  // Einnahmen: neue Transactions (SESSION) + legacy INCOME
  const incomeRows = [
    ...newTxs.filter(t => t.direction === 'INCOME' && t.lifecycleStatus === 'ACTIVE').map(t => ({
      id: t.id, source: 'new', date: t.transactionDate, amount: Number(t.amountGross),
      type: 'Sitzungsrechnung', status: t.paymentStatus === 'PAID' ? 'Bezahlt' : 'Offen',
      statusClass: t.paymentStatus === 'PAID' ? 'badge-green' : 'badge-amber',
      ref: t.referenceNumber, payer: t.payerName,
      paymentMethod: TX_PAYMENT_METHODS[t.paymentMethod] ?? '—',
      raw: t,
    })),
    ...legacyTxs.filter(t => t.type === 'INCOME').map(t => ({
      id: t.id, source: 'legacy', date: t.date, amount: Number(t.amount),
      type: INCOME_CATS[t.incomeCategory] ?? t.incomeCategory ?? 'Einnahme',
      status: t.paymentStatus === 'PAID' ? 'Bezahlt' : 'Offen',
      statusClass: t.paymentStatus === 'PAID' ? 'badge-green' : 'badge-amber',
      ref: t.invoiceNumber ?? '—', payer: t.description ?? '—',
      paymentMethod: LEGACY_PAYMENT_METHODS[t.paymentMethod] ?? '—',
      raw: t,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Ausgaben: legacy EXPENSE
  const expenseRows = legacyTxs.filter(t => t.type === 'EXPENSE').map(t => ({
    id: t.id, source: 'legacy', date: t.date, amount: Number(t.amount),
    type: EXPENSE_CATS[t.expenseCategory] ?? t.expenseCategory ?? 'Ausgabe',
    status: t.paymentStatus === 'PAID' ? 'Bezahlt' : 'Offen',
    statusClass: t.paymentStatus === 'PAID' ? 'badge-green' : 'badge-amber',
    ref: t.invoiceNumber ?? '—', payee: t.description ?? '—',
    paymentMethod: LEGACY_PAYMENT_METHODS[t.paymentMethod] ?? '—',
    raw: t,
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalIncome   = incomeRows.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0)
  const totalMileage  = miles.reduce((s, m) => s + Number(m.totalAmount), 0)
  const paidIncome    = incomeRows.filter(r => r.status === 'Bezahlt').reduce((s, r) => s + r.amount, 0)
  const unpaidIncome  = incomeRows.filter(r => r.status !== 'Bezahlt').reduce((s, r) => s + r.amount, 0)

  // Filter
  const filteredIncome  = incomeRows.filter(r =>
    !incomeSearch || [r.payer, r.type, r.ref, String(r.amount)].some(v =>
      v.toLowerCase().includes(incomeSearch.toLowerCase())
    )
  )
  const filteredExpenses = expenseRows.filter(r =>
    !expenseSearch || [r.payee, r.type, r.ref, String(r.amount)].some(v =>
      v.toLowerCase().includes(expenseSearch.toLowerCase())
    )
  )

  // ── Aktionen ───────────────────────────────────────────────────────────────

  async function saveManual() {
    setSavingManual(true)
    const net = parseFloat(manualForm.amountNet || '0')
    const vat = manualForm.vatRate / 100
    if (manualDir === 'EXPENSE') {
      // Ausgabe → legacy FinanceTransaction
      await fetch('/api/finance/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'EXPENSE', amount: net, date: manualForm.date,
          description: manualForm.payeeName || manualForm.notes || '',
          paymentMethod: manualForm.paymentMethod === 'UNBAR_BANK_TRANSFER' ? 'BANK_TRANSFER'
            : manualForm.paymentMethod === 'CASH' ? 'CASH' : 'OTHER',
          paymentStatus: manualForm.paid ? 'PAID' : 'PENDING',
          expenseCategory: manualForm.expenseCategory,
          invoiceNumber: '', note: manualForm.notes,
        }),
      })
    } else {
      // Einnahme → neue Transaction-Tabelle
      await fetch('/api/transactions/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'INCOME',
          amountNet: net, vatRate: vat,
          transactionDate: manualForm.date,
          payerName: manualForm.payerName || 'Klient*in',
          payerAddress: manualForm.payerAddress,
          payeeName: manualForm.payeeName || 'Praxis',
          paid: manualForm.paid,
          paymentMethod: manualForm.paymentMethod,
          notes: manualForm.notes,
        }),
      })
    }
    setSavingManual(false)
    setShowManualTx(false)
    setManualForm({ payerName:'', payerAddress:'', payeeName:'', payeeAddress:'',
      amountNet:'', vatRate:0, date:new Date().toISOString().slice(0,10),
      paid:true, paidAt:new Date().toISOString().slice(0,10),
      paymentMethod:'UNBAR_BANK_TRANSFER', notes:'',
      expenseCategory:'MISC_BUSINESS', incomeCategory:'HONORAR' })
    load()
  }

  async function saveMile() {
    setSavingMile(true)
    const km  = parseFloat(mileForm.kilometers)
    const actualKm = mileForm.returnTrip ? km * 2 : km
    const rate = parseFloat(mileForm.ratePerKm)
    await fetch('/api/finance/mileage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mileForm,
        kilometers: actualKm,
        returnTrip: mileForm.returnTrip,
        ratePerKm: rate,
        totalAmount: actualKm * rate,
      }),
    })
    setSavingMile(false); setShowMileForm(false)
    setMileForm({ date:new Date().toISOString().slice(0,10), departure:'', destination:'',
      purpose:'OTHER', purposeNote:'', kilometers:'', ratePerKm:'0.42', returnTrip:false })
    load()
  }

  async function deleteLegacyTx(id: string) {
    if (!confirm('Rechnung löschen?')) return
    await fetch(`/api/finance/transactions/${id}`, { method: 'DELETE' })
    load()
  }

  async function cancelNewTx(id: string) {
    if (!confirm('Rechnung stornieren? Es wird eine Gegenbuchung erstellt.')) return
    await fetch(`/api/transactions/${id}/cancel`, { method: 'POST' })
    load()
  }

  async function markNewTxPaid(id: string) {
    await fetch(`/api/transactions/${id}/mark-paid`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'UNBAR_BANK_TRANSFER' }),
    })
    load()
  }

  async function deleteMile(id: string) {
    if (!confirm('Eintrag löschen?')) return
    await fetch(`/api/finance/mileage/${id}`, { method: 'DELETE' })
    load()
  }

  function exportCSV(data: any[], filename: string) {
    if (!data.length) return
    const keys = ['date', 'type', 'amount', 'status', 'ref', 'paymentMethod']
    const csv = [
      keys.join(';'),
      ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(';'))
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = filename; a.click()
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Meine Finanzen</h1>
        </div>
        <select value={year} onChange={e => setYear(+e.target.value)} className="input" style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw style={{ width: 14, height: 14, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
        </button>
        <button onClick={() => { setManualDir('INCOME'); setShowManualTx(true) }} className="btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Einnahme
        </button>
        <button onClick={() => { setManualDir('EXPENSE'); setShowManualTx(true) }} className="btn-secondary">
          <Plus style={{ width: 14, height: 14 }} /> Ausgabe
        </button>
        <button onClick={() => setShowMileForm(true)} className="btn-secondary">
          <Car style={{ width: 14, height: 14 }} /> Fahrt
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '12px 20px 0', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {([
            ['overview', 'Übersicht'],
            ['income',   'Einnahmen'],
            ['expenses', 'Ausgaben'],
            ['mileage',  'Fahrtenbuch'],
            ['gewinn',   'Gewinnermittlung'],
            ['sammelabrechnung', 'Sammelabrechnung'],
          ] as [MainTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === key ? 600 : 400,
                color: tab === key ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>

        {/* ── ÜBERSICHT ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Bezahlte Einnahmen', value: paidIncome,   icon: TrendingUp,   color: 'var(--green)',           bg: 'var(--green-bg)' },
                { label: 'Ausgaben',            value: totalExpenses,icon: TrendingDown,  color: 'var(--red)',             bg: 'var(--red-bg)' },
                { label: 'Ergebnis',            value: paidIncome - totalExpenses, icon: DollarSign, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                { label: 'Offene Einnahmen',    value: unpaidIncome, icon: TrendingUp,   color: 'var(--amber)',           bg: 'var(--amber-bg)' },
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

            {/* Letzte Rechnungen */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Letzte Rechnungen
                </h2>
                <button onClick={() => exportCSV(incomeRows.slice(0, 20), `finanzen-${year}.csv`)} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Download style={{ width: 13, height: 13 }} /> CSV
                </button>
              </div>
              <table className="data-table">
                <thead><tr>
                  <th>Datum</th><th>Bezeichnung</th><th>Typ</th>
                  <th>Status</th><th style={{ textAlign: 'right' }}>Betrag</th>
                </tr></thead>
                <tbody>
                  {[...incomeRows.slice(0, 10), ...expenseRows.slice(0, 5)]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 15)
                    .map(r => (
                    <tr key={r.id} onClick={() => setDetailTx(r)} style={{ cursor: 'pointer' }}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="primary">{'payer' in r ? r.payer : r.payee}</td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{r.type}</span></td>
                      <td><span className={`badge ${r.statusClass}`} style={{ fontSize: 10 }}>{r.status}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600,
                        color: 'payer' in r ? 'var(--green)' : 'var(--red)' }}>
                        {'payer' in r ? '+' : '-'}{fmtEUR(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EINNAHMEN ── */}
        {tab === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Suchzeile */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                Einnahmen {year} — {fmtEUR(totalIncome)}
              </h2>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 9, top: 8, width: 14, height: 14, stroke: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 28, width: 220 }} placeholder="Suchen..."
                  value={incomeSearch} onChange={e => setIncomeSearch(e.target.value)} />
              </div>
              <button onClick={() => exportCSV(filteredIncome, `einnahmen-${year}.csv`)} className="btn-secondary" style={{ fontSize: 12 }}>
                <Download style={{ width: 13, height: 13 }} /> CSV
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Herkunft</th><th>Betrag</th><th>Typ</th>
                  <th>Datum</th><th>Status</th><th>Zahlungsart</th><th>Referenz</th><th></th>
                </tr></thead>
                <tbody>
                  {filteredIncome.map(r => (
                    <tr key={r.id} onClick={() => setDetailTx(r)} style={{ cursor: 'pointer' }}>
                      <td className="primary">{r.payer}</td>
                      <td style={{ fontWeight: 600, color: 'var(--green)' }}>+{fmtEUR(r.amount)}</td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{r.type}</span></td>
                      <td>{fmtDate(r.date)}</td>
                      <td><span className={`badge ${r.statusClass}`} style={{ fontSize: 10 }}>{r.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.paymentMethod}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.ref}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {r.source === 'new' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {r.raw.paymentStatus === 'UNPAID' && (
                              <button onClick={() => markNewTxPaid(r.id)} className="btn-secondary" style={{ fontSize: 11, padding: '2px 6px' }}>
                                <Check style={{ width: 11, height: 11 }} />
                              </button>
                            )}
                            <button
                              onClick={() => window.open(`/api/transactions/${r.id}/invoice`, '_blank')}
                              className="btn-ghost" style={{ padding: '2px 4px' }} title="Drucken / PDF">
                              <Download style={{ width: 12, height: 12 }} />
                            </button>
                            {r.raw.lifecycleStatus === 'ACTIVE' && (
                              <button onClick={() => cancelNewTx(r.id)} className="btn-ghost" style={{ padding: '2px 4px', color: 'var(--red)' }}>
                                <Ban style={{ width: 12, height: 12 }} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => deleteLegacyTx(r.id)} className="btn-ghost" style={{ padding: '2px 4px' }}>
                            <Trash2 style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredIncome.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p className="empty-state-text">Keine Einnahmen gefunden.</p>
                </div>
              )}
            </div>

            {/* Detail-Panel */}
            {detailTx && tab === 'income' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Details — {detailTx.ref}</h3>
                  <button onClick={() => setDetailTx(null)} className="btn-ghost" style={{ padding: 4 }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  {[
                    ['Herkunft', detailTx.payer ?? '—'],
                    ['Referenz', detailTx.ref],
                    ['Erstellungsdatum', fmtDate(detailTx.raw?.createdAt ?? detailTx.date)],
                    ['Datum', fmtDate(detailTx.date)],
                    ['Betrag', fmtEUR(detailTx.amount)],
                    ['Status', detailTx.status],
                    ['Zahlungsart', detailTx.paymentMethod],
                    ['Notizen', detailTx.raw?.notes ?? '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="field-row">
                      <span className="field-label">{l}</span>
                      <span className="field-value">{v}</span>
                    </div>
                  ))}
                </div>
                {detailTx.source === 'new' && detailTx.raw?.paymentStatus === 'UNPAID' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button onClick={() => markNewTxPaid(detailTx.id)} className="btn-primary" style={{ fontSize: 12 }}>
                      <Check style={{ width: 12, height: 12 }} /> Als bezahlt markieren
                    </button>
                    <button onClick={() => cancelNewTx(detailTx.id)} className="btn-danger" style={{ fontSize: 12 }}>
                      <Ban style={{ width: 12, height: 12 }} /> Stornieren
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AUSGABEN ── */}
        {tab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                Ausgaben {year} — {fmtEUR(totalExpenses)}
              </h2>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 9, top: 8, width: 14, height: 14, stroke: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 28, width: 220 }} placeholder="Suchen..."
                  value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} />
              </div>
              <button onClick={() => exportCSV(filteredExpenses, `ausgaben-${year}.csv`)} className="btn-secondary" style={{ fontSize: 12 }}>
                <Download style={{ width: 13, height: 13 }} /> CSV
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Begünstigte</th><th>Betrag</th><th>Typ</th>
                  <th>Datum</th><th>Status</th><th>Zahlungsart</th><th>Referenz</th><th></th>
                </tr></thead>
                <tbody>
                  {filteredExpenses.map(r => (
                    <tr key={r.id} onClick={() => setDetailTx(r)} style={{ cursor: 'pointer' }}>
                      <td className="primary">{r.payee}</td>
                      <td style={{ fontWeight: 600, color: 'var(--red)' }}>-{fmtEUR(r.amount)}</td>
                      <td><span className="badge badge-red" style={{ fontSize: 10 }}>{r.type}</span></td>
                      <td>{fmtDate(r.date)}</td>
                      <td><span className={`badge ${r.statusClass}`} style={{ fontSize: 10 }}>{r.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.paymentMethod}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.ref}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => deleteLegacyTx(r.id)} className="btn-ghost" style={{ padding: '2px 4px' }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredExpenses.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p className="empty-state-text">Keine Ausgaben gefunden.</p>
                </div>
              )}
            </div>

            {/* Detail-Panel Ausgaben */}
            {detailTx && tab === 'expenses' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Details — {detailTx.ref}</h3>
                  <button onClick={() => setDetailTx(null)} className="btn-ghost" style={{ padding: 4 }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  {[
                    ['Begünstigte', detailTx.payee ?? '—'],
                    ['Referenz/Belegnr.', detailTx.ref],
                    ['Datum', fmtDate(detailTx.date)],
                    ['Betrag', fmtEUR(detailTx.amount)],
                    ['Kategorie', detailTx.type],
                    ['Status', detailTx.status],
                    ['Zahlungsart', detailTx.paymentMethod],
                  ].map(([l, v]) => (
                    <div key={l} className="field-row">
                      <span className="field-label">{l}</span>
                      <span className="field-value">{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 6, fontSize: 12, color: 'var(--amber)', display: 'flex', gap: 6 }}>
                  <Info style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
                  Für Ausgaben stellt KDS keine Rechnung aus. Bitte den Original-Beleg aufbewahren.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FAHRTENBUCH ── */}
        {tab === 'mileage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Eingabezeile direkt oben (laut Screenshot) */}
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Fahrtenbuch Eintrag
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr) auto auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label className="label">Von</label>
                  <input className="input" value={mileForm.departure}
                    onChange={e => setMileForm(f => ({ ...f, departure: e.target.value }))}
                    placeholder="Abfahrtsort" />
                </div>
                <div>
                  <label className="label">Bis / Nach</label>
                  <input className="input" value={mileForm.destination}
                    onChange={e => setMileForm(f => ({ ...f, destination: e.target.value }))}
                    placeholder="Zielort" />
                </div>
                <div>
                  <label className="label">Distanz (km)</label>
                  <input type="number" className="input" step="0.1" min="0" value={mileForm.kilometers}
                    onChange={e => setMileForm(f => ({ ...f, kilometers: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Datum</label>
                  <input type="date" className="input" value={mileForm.date}
                    onChange={e => setMileForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Zweck</label>
                  <input className="input" value={mileForm.purposeNote}
                    onChange={e => setMileForm(f => ({ ...f, purposeNote: e.target.value }))}
                    placeholder="z.B. Hausbesuch" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
                  <input type="checkbox" id="retour" checked={mileForm.returnTrip}
                    onChange={e => setMileForm(f => ({ ...f, returnTrip: e.target.checked }))} />
                  <label htmlFor="retour" style={{ fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Retour?
                  </label>
                </div>
                <button onClick={saveMile} disabled={savingMile || !mileForm.departure || !mileForm.kilometers}
                  className="btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {savingMile ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              {mileForm.kilometers && mileForm.returnTrip && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Retour: {(parseFloat(mileForm.kilometers) * 2).toFixed(1)} km ×
                  € {mileForm.ratePerKm}/km = {fmtEUR(parseFloat(mileForm.kilometers) * 2 * parseFloat(mileForm.ratePerKm))}
                </p>
              )}
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {miles.reduce((s, m) => s + Number(m.kilometers), 0).toFixed(1)} km ·
                  {fmtEUR(totalMileage)}
                </span>
                <button onClick={() => exportCSV(miles, `fahrtenbuch-${year}.csv`)} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Download style={{ width: 13, height: 13 }} /> CSV
                </button>
              </div>
              <table className="data-table">
                <thead><tr>
                  <th>Datum</th><th>Von</th><th>Nach</th><th>Distanz</th><th>Zweck</th>
                  <th style={{ textAlign: 'right' }}>Betrag</th><th></th>
                </tr></thead>
                <tbody>
                  {miles.map(m => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.date)}</td>
                      <td>{m.departure}</td>
                      <td>{m.destination}</td>
                      <td>{Number(m.kilometers).toFixed(1)} km</td>
                      <td>
                        <span className="badge badge-indigo" style={{ fontSize: 10 }}>
                          {TRIP_PURPOSE[m.purpose] ?? m.purpose}
                        </span>
                        {m.purposeNote && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{m.purposeNote}</span>}
                        {m.returnTrip && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>↩ Retour</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {fmtEUR(Number(m.totalAmount))}
                      </td>
                      <td>
                        <button onClick={() => deleteMile(m.id)} className="btn-ghost" style={{ padding: '2px 4px' }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {miles.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <Car className="empty-state-icon" style={{ width: 32, height: 32 }} />
                  <p className="empty-state-text">Noch keine Fahrten erfasst.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GEWINNERMITTLUNG ── */}
        {tab === 'gewinn' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Disclaimer */}
            <div style={{
              padding: '10px 14px', background: 'var(--amber-bg)',
              border: '0.5px solid var(--amber-border,#fcd34d)', borderRadius: 8,
              fontSize: 12, color: 'var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
              <span>
                Diese Auswertung dient der Orientierung und stellt <strong>keine verbindliche Steuerberatung</strong> dar.
                Bitte wenden Sie sich für steuerliche Fragen an eine zugelassene Steuerberatung.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Betriebseinnahmen */}
              <div className="card" style={{ padding: 20 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Betriebseinnahmen
                </h2>
                {profit?.income?.byCategory && Object.entries(profit.income.byCategory as Record<string,number>).map(([k, v]) => (
                  v > 0 ? (
                    <div key={k} className="field-row">
                      <span className="field-label">{INCOME_CATS[k] ?? k}</span>
                      <span className="field-value" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtEUR(v)}</span>
                    </div>
                  ) : null
                ))}
                <div className="field-row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Zwischensumme Einnahmen</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmtEUR(profit?.income?.total ?? totalIncome)}</span>
                </div>
              </div>

              {/* Ausgaben */}
              <div className="card" style={{ padding: 20 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Ausgaben
                </h2>
                {profit?.expenses?.byCategory && Object.entries(profit.expenses.byCategory as Record<string,number>).map(([k, v]) => (
                  v > 0 ? (
                    <div key={k} className="field-row">
                      <span className="field-label">{EXPENSE_CATS[k] ?? k}</span>
                      <span className="field-value" style={{ color: 'var(--red)' }}>-{fmtEUR(v)}</span>
                    </div>
                  ) : null
                ))}
                {(profit?.expenses?.mileage ?? totalMileage) > 0 && (
                  <div className="field-row">
                    <span className="field-label">
                      Kilometergeld ({Number(profit?.expenses?.mileageKm ?? 0).toFixed(1)} km)
                    </span>
                    <span className="field-value" style={{ color: 'var(--red)' }}>
                      -{fmtEUR(profit?.expenses?.mileage ?? totalMileage)}
                    </span>
                  </div>
                )}
                <div className="field-row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Zwischensumme Ausgaben</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
                    -{fmtEUR(profit?.expenses?.total ?? (totalExpenses + totalMileage))}
                  </span>
                </div>
              </div>
            </div>

            {/* Ergebnis */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Gewinn {year}
                </span>
                <span style={{
                  fontSize: 24, fontWeight: 800,
                  color: (profit?.profit ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {fmtEUR(profit?.profit ?? 0)}
                </span>
              </div>
              <div className="field-row">
                <span className="field-label">Grundfreibetrag 15% vom Gewinn</span>
                <span className="field-value" style={{ color: 'var(--red)' }}>-{fmtEUR(profit?.grundfreibetrag ?? 0)}</span>
              </div>
              <div className="field-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Einkünfte aus Gewerbebetrieb / selbständiger Arbeit
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)' }}>
                  {fmtEUR(profit?.einkuenfte ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'sammelabrechnung' && (
          <SammelabrechungPanel year={year} />
        )}
      </div>

      {/* ══ MODAL: Manuelle Rechnung ══ */}
      {showManualTx && (
        <div className="modal-overlay" onClick={() => setShowManualTx(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 15 }}>Rechnung hinzufügen</h2>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['INCOME', 'EXPENSE'] as const).map(d => (
                    <button key={d} onClick={() => setManualDir(d)}
                      className={manualDir === d ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 12, padding: '3px 10px' }}>
                      {d === 'INCOME' ? 'Einnahme' : 'Ausgabe'}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowManualTx(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Herkunft / Begünstigte */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                    {manualDir === 'INCOME' ? 'Herkunft' : 'Begünstigte'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="input" placeholder="Name" value={manualDir === 'INCOME' ? manualForm.payerName : manualForm.payeeName}
                      onChange={e => manualDir === 'INCOME'
                        ? setManualForm(f => ({ ...f, payerName: e.target.value }))
                        : setManualForm(f => ({ ...f, payeeName: e.target.value }))} />
                    <input className="input" placeholder="Adressezeile 1" value={manualDir === 'INCOME' ? manualForm.payerAddress : manualForm.payeeAddress}
                      onChange={e => manualDir === 'INCOME'
                        ? setManualForm(f => ({ ...f, payerAddress: e.target.value }))
                        : setManualForm(f => ({ ...f, payeeAddress: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                    {manualDir === 'INCOME' ? 'Begünstigte' : 'Herkunft'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="input" placeholder="Name" value={manualDir === 'INCOME' ? manualForm.payeeName : manualForm.payerName}
                      onChange={e => manualDir === 'INCOME'
                        ? setManualForm(f => ({ ...f, payeeName: e.target.value }))
                        : setManualForm(f => ({ ...f, payerName: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Allgemeine Daten */}
              <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                Allgemeine Daten
              </h4>
              <div className="form-grid-2">
                <div>
                  <label className="label">Betrag (€ Netto) *</label>
                  <input type="number" step="0.01" className="input" placeholder="0,00"
                    value={manualForm.amountNet}
                    onChange={e => setManualForm(f => ({ ...f, amountNet: e.target.value }))} />
                </div>
                <div>
                  <label className="label">
                    {manualDir === 'INCOME' ? 'Rechnungstyp' : 'Rechnungstyp / Kategorie'}
                  </label>
                  {manualDir === 'INCOME' ? (
                    <select className="input" value={manualForm.incomeCategory}
                      onChange={e => setManualForm(f => ({ ...f, incomeCategory: e.target.value }))}>
                      {Object.entries(INCOME_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <select className="input" value={manualForm.expenseCategory}
                      onChange={e => setManualForm(f => ({ ...f, expenseCategory: e.target.value }))}>
                      {Object.entries(EXPENSE_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">Datum *</label>
                  <input type="date" className="input" value={manualForm.date}
                    onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Zahlungsart</label>
                  <select className="input" value={manualForm.paymentMethod}
                    onChange={e => setManualForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    {Object.entries(TX_PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-panel)', borderRadius: 8 }}>
                <input type="checkbox" id="isPaid" checked={manualForm.paid}
                  onChange={e => setManualForm(f => ({ ...f, paid: e.target.checked }))} />
                <label htmlFor="isPaid" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Bezahlt
                </label>
                {manualForm.paid && (
                  <input type="date" className="input" value={manualForm.paidAt} style={{ marginLeft: 8 }}
                    onChange={e => setManualForm(f => ({ ...f, paidAt: e.target.value }))} />
                )}
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              <div>
                <label className="label">Notiz</label>
                <textarea className="input" rows={2} value={manualForm.notes}
                  onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>

              {/* Betrag-Vorschau */}
              {manualForm.amountNet && (
                <div style={{
                  padding: '10px 14px', background: 'var(--color-primary-light)',
                  borderRadius: 8, fontSize: 13, color: 'var(--color-primary)',
                }}>
                  Netto: {fmtEUR(parseFloat(manualForm.amountNet))} ·
                  MwSt. {manualForm.vatRate}%: {fmtEUR(parseFloat(manualForm.amountNet) * manualForm.vatRate / 100)} ·
                  Brutto: {fmtEUR(parseFloat(manualForm.amountNet) * (1 + manualForm.vatRate / 100))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowManualTx(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={saveManual} disabled={savingManual || !manualForm.amountNet || !manualForm.date}
                className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingManual ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Fahrt (Fallback wenn nicht über Tab) ══ */}
      {showMileForm && (
        <div className="modal-overlay" onClick={() => setShowMileForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>Fahrt erfassen</h2>
              <button onClick={() => setShowMileForm(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Datum *</label>
                <input type="date" className="input" value={mileForm.date}
                  onChange={e => setMileForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div><label className="label">Abfahrtsort *</label>
                  <input className="input" value={mileForm.departure}
                    onChange={e => setMileForm(f => ({ ...f, departure: e.target.value }))} />
                </div>
                <div><label className="label">Zielort *</label>
                  <input className="input" value={mileForm.destination}
                    onChange={e => setMileForm(f => ({ ...f, destination: e.target.value }))} />
                </div>
                <div><label className="label">Kilometer *</label>
                  <input type="number" step="0.1" className="input" value={mileForm.kilometers}
                    onChange={e => setMileForm(f => ({ ...f, kilometers: e.target.value }))} />
                </div>
                <div><label className="label">€/km</label>
                  <input type="number" step="0.01" className="input" value={mileForm.ratePerKm}
                    onChange={e => setMileForm(f => ({ ...f, ratePerKm: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="retourModal" checked={mileForm.returnTrip}
                  onChange={e => setMileForm(f => ({ ...f, returnTrip: e.target.checked }))} />
                <label htmlFor="retourModal" style={{ fontSize: 13, cursor: 'pointer' }}>
                  Retour? (Distanz wird verdoppelt)
                </label>
              </div>
              <div><label className="label">Beschreibung</label>
                <input className="input" value={mileForm.purposeNote}
                  onChange={e => setMileForm(f => ({ ...f, purposeNote: e.target.value }))} />
              </div>
              {mileForm.kilometers && (
                <div style={{ padding: '8px 12px', background: 'var(--color-primary-light)', borderRadius: 8, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                  {fmtEUR((mileForm.returnTrip ? parseFloat(mileForm.kilometers) * 2 : parseFloat(mileForm.kilometers)) * parseFloat(mileForm.ratePerKm))}
                  {mileForm.returnTrip && ` (${(parseFloat(mileForm.kilometers) * 2).toFixed(1)} km × € ${mileForm.ratePerKm})`}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMileForm(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={saveMile} disabled={savingMile || !mileForm.kilometers || !mileForm.departure}
                className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingMile ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
