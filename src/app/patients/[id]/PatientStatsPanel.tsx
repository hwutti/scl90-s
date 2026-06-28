
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(new Date(d))
}

export function PatientStatsPanel({ patientId }: { patientId: string }) {
  const [ratings, setRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    ratingDate: new Date().toISOString().slice(0, 10),
    wellbeing: 5, anxiety: 5, depression: 5, sessionSatisfaction: 5, goalProgress: 5, note: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch(`/api/patients/${patientId}/ratings`).then(r => r.json())
    setRatings(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  async function addRating() {
    setSaving(true)
    await fetch(`/api/patients/${patientId}/ratings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowAdd(false); load()
  }

  const chartData = ratings.map(r => ({
    datum: fmtDate(r.ratingDate),
    'Wohlbefinden': r.wellbeing,
    'Angst (inv.)': r.anxiety ? 11 - r.anxiety : null,
    'Depression (inv.)': r.depression ? 11 - r.depression : null,
    'Sitzungszufr.': r.sessionSatisfaction,
    'Zielfortschritt': r.goalProgress,
  }))

  const COLORS = ['#4f46e5', '#dc2626', '#d97706', '#16a34a', '#7c3aed']
  const LINES = ['Wohlbefinden', 'Angst (inv.)', 'Depression (inv.)', 'Sitzungszufr.', 'Zielfortschritt']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Verlaufsstatistiken</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Skala 1–10, Angst und Depression invertiert (höher = besser)</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus style={{ width: 13, height: 13 }} /> Bewertung hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
      ) : ratings.length < 2 ? (
        <div className="card" style={{ padding: 32 }}>
          <div className="empty-state">
            <TrendingUp className="empty-state-icon" style={{ width: 36, height: 36 }} />
            <p className="empty-state-text">Mindestens 2 Bewertungen für Verlaufsdiagramm nötig.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ marginTop: 12 }}>
              <Plus style={{ width: 13, height: 13 }} /> Erste Bewertung erfassen
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="datum" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis domain={[1, 10]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              {LINES.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i]}
                  strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent ratings table */}
      {ratings.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr>
              <th>Datum</th><th>Wohlbefinden</th><th>Angst</th><th>Depression</th><th>Sitzungszufr.</th><th>Zielfortschritt</th>
            </tr></thead>
            <tbody>
              {[...ratings].reverse().slice(0, 10).map((r: any) => (
                <tr key={r.id}>
                  <td className="primary">{fmtDate(r.ratingDate)}</td>
                  {['wellbeing','anxiety','depression','sessionSatisfaction','goalProgress'].map(k => (
                    <td key={k}>
                      <span style={{
                        display: 'inline-block', minWidth: 28, textAlign: 'center',
                        padding: '2px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: r[k] >= 7 ? 'var(--green-bg)' : r[k] >= 4 ? 'var(--amber-bg)' : 'var(--red-bg)',
                        color: r[k] >= 7 ? 'var(--green)' : r[k] >= 4 ? 'var(--amber)' : 'var(--red)',
                      }}>
                        {r[k] ?? '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>Sitzungsbewertung erfassen</h2>
              <button onClick={() => setShowAdd(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Datum</label>
                <input type="date" className="input" value={form.ratingDate}
                  onChange={e => setForm(f => ({ ...f, ratingDate: e.target.value }))} />
              </div>
              {[
                { key: 'wellbeing', label: 'Wohlbefinden', desc: '1 = sehr schlecht · 10 = ausgezeichnet' },
                { key: 'anxiety', label: 'Angst', desc: '1 = keine Angst · 10 = maximale Angst' },
                { key: 'depression', label: 'Depressivität', desc: '1 = keine · 10 = sehr stark' },
                { key: 'sessionSatisfaction', label: 'Sitzungszufriedenheit', desc: '1 = unzufrieden · 10 = sehr zufrieden' },
                { key: 'goalProgress', label: 'Fortschritt Therapieziele', desc: '1 = kein Fortschritt · 10 = voller Fortschritt' },
              ].map(({ key, label, desc }) => (
                <div key={key}>
                  <label className="label">{label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {(form as any)[key]}/10</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="range" min={1} max={10} value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: +e.target.value }))}
                      style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', minWidth: 28, textAlign: 'right' }}>
                      {(form as any)[key]}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{desc}</p>
                </div>
              ))}
              <div>
                <label className="label">Notiz</label>
                <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Optionale Anmerkung..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdd(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={addRating} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'Speichern...' : 'Bewertung speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
