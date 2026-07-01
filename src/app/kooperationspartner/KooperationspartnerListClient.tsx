'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Handshake, Plus, Users, FileText, X } from 'lucide-react'

interface Partner {
  id: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  city: string | null
  _count: { patients: number; transactions: number }
}

export function KooperationspartnerListClient({
  partners, invoiceTemplates, role,
}: {
  partners: Partner[]
  invoiceTemplates: { id: string; name: string; isDefault: boolean }[]
  role: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', address: '', postalCode: '', city: '',
    contactPerson: '', email: '', phone: '', uidNumber: '',
    defaultVatRate: 0, defaultPaymentMethod: 'UNBAR_BANK_TRANSFER',
    defaultInvoiceTemplateId: invoiceTemplates.find(t => t.isDefault)?.id ?? '',
    notes: '',
  })

  async function createPartner() {
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/cooperation-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok && data.id) {
      setCreating(false)
      router.push(`/kooperationspartner/${data.id}`)
    } else {
      setError(data.error ?? 'Fehler beim Anlegen.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Kooperationspartner</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {partners.length} {partners.length === 1 ? 'Partner' : 'Partner'} — Patienten & Rechnungen sind komplett vom normalen Patientenstamm getrennt
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Neuer Kooperationspartner
        </button>
      </div>

      <div style={{ padding: 20, flex: 1 }}>
        {partners.length === 0 ? (
          <div className="empty-state" style={{ flexDirection: 'column', gap: 10, padding: 40 }}>
            <Handshake style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Noch keine Kooperationspartner angelegt.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {partners.map(p => (
              <Link key={p.id} href={`/kooperationspartner/${p.id}`} className="card p-4" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Handshake style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                </div>
                {(p.contactPerson || p.city) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {[p.contactPerson, p.city].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users style={{ width: 12, height: 12 }} /> {p._count.patients} Patient{p._count.patients === 1 ? '' : 'en'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText style={{ width: 12, height: 12 }} /> {p._count.transactions} Rechnung{p._count.transactions === 1 ? '' : 'en'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Neuer Kooperationspartner ── */}
      {creating && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Neuer Kooperationspartner</h3>
              <button onClick={() => setCreating(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Sozialverein XY" />
              </div>
              <div className="form-grid-2">
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
                  <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Straße, Hausnummer" />
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

              {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => setCreating(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
                <button onClick={createPartner} disabled={loading || !form.name.trim()} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {loading ? 'Anlegen...' : 'Anlegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
