'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Handshake, Save, Pencil, X, FileText, Check, RotateCcw, Ban, Euro } from 'lucide-react'

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
const PAYMENT_METHODS: Record<string, string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung', CASH: 'Bar', CARD_BANKOMAT: 'Karte / Bankomat',
}

interface Partner {
  id: string
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  contactPerson: string | null
  email: string | null
  phone: string | null
  uidNumber: string | null
  defaultVatRate: any
  defaultPaymentMethod: string | null
  defaultInvoiceTemplateId: string | null
  notes: string | null
}

export function KooperationspartnerDetailClient({
  partner, invoiceTemplates, role,
}: {
  partner: Partner
  invoiceTemplates: { id: string; name: string; isDefault: boolean }[]
  role: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: partner.name,
    address: partner.address ?? '',
    postalCode: partner.postalCode ?? '',
    city: partner.city ?? '',
    contactPerson: partner.contactPerson ?? '',
    email: partner.email ?? '',
    phone: partner.phone ?? '',
    uidNumber: partner.uidNumber ?? '',
    defaultVatRate: parseFloat(partner.defaultVatRate?.toString() ?? '0'),
    defaultPaymentMethod: partner.defaultPaymentMethod ?? 'UNBAR_BANK_TRANSFER',
    defaultInvoiceTemplateId: partner.defaultInvoiceTemplateId ?? '',
    notes: partner.notes ?? '',
  })

  async function save() {
    setSaving(true)
    await fetch(`/api/cooperation-partners/${partner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  // ── Rechnungen dieses Partners ──
  const [transactions, setTransactions] = useState<any[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const [undoCountdown, setUndoCountdown] = useState<Record<string, number>>({})

  async function loadTransactions() {
    setTxLoading(true)
    const data = await fetch(`/api/transactions?cooperationPartnerId=${partner.id}`).then(r => r.json())
    setTransactions(Array.isArray(data) ? data : [])
    setTxLoading(false)
  }
  useEffect(() => { loadTransactions() }, [])

  useEffect(() => {
    const next: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.paymentStatus === 'PAID' && tx.paymentUndoDeadline) {
        const secs = Math.floor((new Date(tx.paymentUndoDeadline).getTime() - Date.now()) / 1000)
        if (secs > 0) next[tx.id] = secs
      }
    }
    setUndoCountdown(next)
    if (Object.keys(next).length === 0) return
    const interval = setInterval(() => {
      setUndoCountdown(prev => {
        const upd: Record<string, number> = {}
        for (const [id, s] of Object.entries(prev)) if (s > 1) upd[id] = s - 1
        return upd
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [transactions])

  async function markPaid(txId: string) {
    await fetch(`/api/transactions/${txId}/mark-paid`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'UNBAR_BANK_TRANSFER' }),
    })
    loadTransactions()
  }
  async function undoPayment(txId: string) {
    await fetch(`/api/transactions/${txId}/undo-payment`, { method: 'POST' })
    loadTransactions()
  }
  async function cancelTx(txId: string) {
    if (!confirm('Diese Rechnung wirklich stornieren?')) return
    await fetch(`/api/transactions/${txId}/cancel`, { method: 'POST' })
    loadTransactions()
  }

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <Link href="/kooperationspartner" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 10 }}>
        <ArrowLeft style={{ width: 12, height: 12 }} /> Alle Kooperationspartner
      </Link>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Handshake style={{ width: 20, height: 20, color: 'var(--color-primary)' }} />
            {!editing ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{partner.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[partner.contactPerson, partner.address, [partner.postalCode, partner.city].filter(Boolean).join(' ')]
                    .filter(Boolean).join(' · ') || 'Keine weiteren Angaben'}
                </div>
              </div>
            ) : (
              <input className="input" style={{ fontSize: 15, fontWeight: 600, width: 260 }}
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            )}
          </div>

          {role === 'ADMIN' && (
            !editing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/kooperationspartner/${partner.id}/rechnung/neu`} className="btn-primary" style={{ fontSize: 12 }}>
                  <FileText style={{ width: 12, height: 12 }} /> Rechnung erstellen
                </Link>
                <button onClick={() => setEditing(true)} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Pencil style={{ width: 12, height: 12 }} /> Bearbeiten
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(false)} className="btn-ghost" style={{ padding: 6 }}><X style={{ width: 14, height: 14 }} /></button>
                <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 12 }}>
                  <Save style={{ width: 12, height: 12 }} /> {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            )
          )}
        </div>

        {editing && (
          <div className="form-grid-2" style={{ marginTop: 14 }}>
            <div>
              <label className="label">Kontaktperson</label>
              <input className="input" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="label">UID-Nummer</label>
              <input className="input" value={form.uidNumber} onChange={e => setForm(f => ({ ...f, uidNumber: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Adresse</label>
              <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="label">PLZ</label>
              <input className="input" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ort</label>
              <input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">Standard-USt.</label>
              <select className="input" value={form.defaultVatRate} onChange={e => setForm(f => ({ ...f, defaultVatRate: parseFloat(e.target.value) }))}>
                <option value={0}>0%</option>
                <option value={0.1}>10%</option>
                <option value={0.2}>20%</option>
              </select>
            </div>
            <div>
              <label className="label">Standard-Zahlungsart</label>
              <select className="input" value={form.defaultPaymentMethod} onChange={e => setForm(f => ({ ...f, defaultPaymentMethod: e.target.value }))}>
                <option value="UNBAR_BANK_TRANSFER">Überweisung</option>
                <option value="CASH">Bar</option>
                <option value="CARD_BANKOMAT">Karte / Bankomat</option>
              </select>
            </div>
            {invoiceTemplates.length > 0 && (
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Standard-Rechnungsvorlage</label>
                <select className="input" value={form.defaultInvoiceTemplateId} onChange={e => setForm(f => ({ ...f, defaultInvoiceTemplateId: e.target.value }))}>
                  <option value="">— keine —</option>
                  {invoiceTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (Standard)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Notizen</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* ── RECHNUNGEN ── */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>
          Rechnungen {transactions.length > 0 && `(${transactions.length})`}
        </h3>
        {txLoading ? (
          <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
        ) : transactions.length === 0 ? (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state">
              <Euro className="empty-state-icon" style={{ width: 36, height: 36 }} />
              <p className="empty-state-text">Noch keine Rechnungen.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transactions.map((tx: any) => (
              <div key={tx.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                        {tx.referenceNumber}
                      </span>
                      <span className={tx.paymentStatus === 'PAID' ? 'badge badge-green' : 'badge badge-amber'}>
                        {tx.paymentStatus === 'PAID' ? 'Bezahlt' : 'Offen'}
                      </span>
                      {tx.lifecycleStatus === 'CANCELLED_ORIGINAL' && <span className="badge badge-red">Storniert</span>}
                      {tx.lifecycleStatus === 'CANCELLATION_TX' && <span className="badge badge-gray">Storno</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>{fmtDate(tx.transactionDate)}</span>
                      <span style={{ fontWeight: 600 }}>{fmtEUR(tx.amountGross)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{tx.lineItems?.length ?? 0} Position{tx.lineItems?.length !== 1 ? 'en' : ''}</span>
                      {tx.paymentMethod && <span style={{ color: 'var(--text-muted)' }}>{PAYMENT_METHODS[tx.paymentMethod]}</span>}
                    </div>
                    {undoCountdown[tx.id] > 0 && (
                      <div style={{ marginTop: 6, padding: '4px 10px', background: 'var(--amber-bg)', borderRadius: 6, fontSize: 12, color: 'var(--amber)' }}>
                        Zahlung rückgängig möglich noch {undoCountdown[tx.id]}s
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {tx.paymentStatus === 'UNPAID' && tx.lifecycleStatus === 'ACTIVE' && (
                      <button onClick={() => markPaid(tx.id)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                        <Check style={{ width: 12, height: 12 }} /> Bezahlt
                      </button>
                    )}
                    {undoCountdown[tx.id] > 0 && (
                      <button onClick={() => undoPayment(tx.id)} className="btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}>
                        <RotateCcw style={{ width: 12, height: 12 }} /> Rückgängig
                      </button>
                    )}
                    <button onClick={() => window.open(`/api/transactions/${tx.id}/invoice`, '_blank')} className="btn-secondary" style={{ fontSize: 12, padding: '4px 8px' }} title="Rechnung anzeigen / drucken">
                      <FileText style={{ width: 13, height: 13 }} />
                    </button>
                    {tx.lifecycleStatus === 'ACTIVE' && (
                      <button onClick={() => cancelTx(tx.id)} className="btn-danger" style={{ fontSize: 12, padding: '4px 8px' }} title="Stornieren">
                        <Ban style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
