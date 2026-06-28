'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, GraduationCap, CheckCircle, Clock, Users, Edit3, Trash2, BarChart2, Save } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}

const SUPERVISION_TYPES: Record<string,string> = {
  INDIVIDUAL: 'Einzelsupervision',
  GROUP: 'Gruppensupervision',
  SELF: 'Selbsterfahrung',
}

const PIE_COLORS = ['var(--color-primary)', 'var(--amber)', 'var(--green)', 'var(--red)']

interface Entry {
  id: string; name?: string; date: string; unitCount?: number; durationMinutes: number
  supervisionType: string; supervisorName?: string; groupParticipants?: string
  content?: string; fachspezifikum: boolean; supervisor?: { name: string }
}

function SupervisionForm({
  initial, onSave, onCancel, saving,
}: {
  initial: Partial<Entry>; onSave: (data: any) => void; onCancel: () => void; saving: boolean
}) {
  const [form, setForm] = useState({
    date: initial.date?.slice(0,10) ?? new Date().toISOString().slice(0,10),
    name: initial.name ?? '',
    supervisorName: initial.supervisorName ?? '',
    groupParticipants: initial.groupParticipants ?? '',
    unitCount: initial.unitCount ?? 1,
    durationMinutes: initial.durationMinutes ?? 60,
    supervisionType: initial.supervisionType ?? 'INDIVIDUAL',
    content: initial.content ?? '',
    fachspezifikum: initial.fachspezifikum ?? true,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="form-grid-2">
        <div>
          <label className="label">Datum *</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Bezeichnung</label>
          <input className="input" placeholder="z.B. Sv_1_02.05.2026" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Supervisor*in</label>
          <input className="input" placeholder="Name des Supervisors" value={form.supervisorName}
            onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} />
        </div>
        <div>
          <label className="label">Art</label>
          <select className="input" value={form.supervisionType}
            onChange={e => setForm(f => ({ ...f, supervisionType: e.target.value }))}>
            {Object.entries(SUPERVISION_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Einheiten</label>
          <input type="number" step="0.5" min="0.5" className="input" value={form.unitCount}
            onChange={e => setForm(f => ({ ...f, unitCount: parseFloat(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Dauer (Min.)</label>
          <input type="number" min="15" step="15" className="input" value={form.durationMinutes}
            onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))} />
        </div>
        {form.supervisionType === 'GROUP' && (
          <div style={{ gridColumn: '1/-1' }}>
            <label className="label">Gruppenteilnehmer*innen</label>
            <input className="input" placeholder="Komma-getrennte Namen" value={form.groupParticipants}
              onChange={e => setForm(f => ({ ...f, groupParticipants: e.target.value }))} />
          </div>
        )}
      </div>
      <div>
        <label className="label">Notiz / Inhalt</label>
        <textarea className="input" rows={3} value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-primary-light)', borderRadius: 8 }}>
        <input type="checkbox" id="fach" checked={form.fachspezifikum}
          onChange={e => setForm(f => ({ ...f, fachspezifikum: e.target.checked }))} />
        <label htmlFor="fach" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 500 }}>
          Zählt für Fachspezifikum (psychotherapeutische Ausbildung)
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.date}
          className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? 'Speichern...' : <><Save style={{width:12,height:12}}/> Speichern</>}
        </button>
      </div>
    </div>
  )
}

export function SupervisionClient() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear]   = useState(new Date().getFullYear())
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [selected, setSelected] = useState<Entry|null>(null)
  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch(`/api/supervision?year=${year}`).then(r => r.json())
    setEntries(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  async function create(form: any) {
    setSaving(true)
    await fetch('/api/supervision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowNew(false); load()
  }

  async function update(id: string, form: any) {
    setSavingEdit(true)
    await fetch(`/api/supervision/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSavingEdit(false); setEditMode(false); setSelected(null); load()
  }

  async function del(id: string) {
    if (!confirm('Supervision-Eintrag löschen?')) return
    await fetch(`/api/supervision/${id}`, { method: 'DELETE' })
    setSelected(null); load()
  }

  // ── Statistiken ────────────────────────────────────────────────────────────
  const totalUnits    = entries.reduce((s, e) => s + (Number(e.unitCount) || e.durationMinutes/60), 0)
  const fachUnits     = entries.filter(e => e.fachspezifikum).reduce((s, e) => s + (Number(e.unitCount) || e.durationMinutes/60), 0)
  const totalMinutes  = entries.reduce((s, e) => s + e.durationMinutes, 0)

  // Ziel: 70 PT-Einheiten, 140 Supervision-Einheiten (österreichische Ausbildungsrichtlinien)
  const PT_ZIEL   = 700
  const SUP_ZIEL  = 140
  const ptPct     = Math.min(100, (totalUnits / PT_ZIEL) * 100)
  const supPct    = Math.min(100, (fachUnits / SUP_ZIEL) * 100)

  // Kreisdiagramm-Daten
  const supervisorCounts: Record<string,number> = {}
  entries.forEach(e => {
    const key = e.supervisorName || e.supervisor?.name || 'Unbekannt'
    supervisorCounts[key] = (supervisorCounts[key] ?? 0) + 1
  })
  const supervisorData = Object.entries(supervisorCounts).map(([name, value]) => ({ name, value }))

  const typeData = Object.entries(SUPERVISION_TYPES).map(([k, label]) => ({
    name: label,
    value: entries.filter(e => e.supervisionType === k).length,
  })).filter(d => d.value > 0)

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Meine Supervisionen</h1>
        </div>
        <select value={year} onChange={e => setYear(+e.target.value)} className="input" style={{ width: 90 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Einheit erfassen
        </button>
      </div>

      {/* Neue Einheit erfassen Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>Supervision erfassen</h2>
              <button onClick={() => setShowNew(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="modal-body">
              <SupervisionForm initial={{}} onSave={create} onCancel={() => setShowNew(false)} saving={saving} />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>

        {/* KPIs + Fortschritt */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Einheiten gesamt', value: totalUnits.toFixed(1), icon: GraduationCap, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
            { label: 'Stunden gesamt',   value: (totalMinutes/60).toFixed(1)+'h', icon: Clock,          color: 'var(--amber)',           bg: 'var(--amber-bg)' },
            { label: 'Fachspezifikum',   value: fachUnits.toFixed(1),             icon: CheckCircle,    color: 'var(--green)',           bg: 'var(--green-bg)' },
            { label: 'Einzelsupervision',value: entries.filter(e=>e.supervisionType==='INDIVIDUAL').length, icon: Users, color: 'var(--blue,#3b82f6)', bg: 'var(--blue-bg,#eff6ff)' },
          ].map(k => (
            <div key={k.label} className="stat-card">
              <div className="stat-icon" style={{ background: k.bg }}>
                <k.icon style={{ width: 15, height: 15, stroke: k.color, fill: 'none' }} />
              </div>
              <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
              <div className="stat-label">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Fortschrittsbalken */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Fortschritt Ausbildung
          </h3>
          {[
            { label: `Psychotherapeutische Einheiten (${totalUnits.toFixed(1)} / ${PT_ZIEL})`, pct: ptPct, color: 'var(--color-primary)' },
            { label: `Supervisionseinheiten Fachspez. (${fachUnits.toFixed(1)} / ${SUP_ZIEL})`, pct: supPct, color: 'var(--green)' },
          ].map(b => (
            <div key={b.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>{b.label}</span>
                <span style={{ fontWeight: 600, color: b.color }}>{b.pct.toFixed(0)}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-panel)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Statistiken / Diagramme */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {/* Aufteilung Supervisor */}
            {supervisorData.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Aufteilung Supervisor*innen
                </h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={supervisorData} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name">
                      {supervisorData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} Einheiten`]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Aufteilung Typ */}
            {typeData.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Einzel-/Gruppensupervisionen
                </h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={typeData} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name">
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} Einheiten`]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fachspezifikum-Anteil */}
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fachspezifikum-Anteil
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Fachspezifikum', value: fachUnits },
                      { name: 'Sonstiges',      value: Math.max(0, totalUnits - fachUnits) },
                    ].filter(d => d.value > 0)}
                    cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name"
                  >
                    <Cell fill="var(--green)" />
                    <Cell fill="var(--surface-panel)" />
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} Einheiten`]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabelle */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Alle Supervisionen
            </h3>
          </div>
          {loading ? (
            <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
          ) : entries.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <GraduationCap className="empty-state-icon" style={{ width: 36, height: 36 }} />
              <p className="empty-state-text">Noch keine Supervisionen für {year} erfasst.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Name</th><th>Datum</th><th>Einheiten</th><th>Supervisor*in</th>
                <th>Gruppenteilnehmer</th><th>Klient*innen-Namen</th>
                <th style={{ textAlign: 'center' }}>Anz. Kl.</th>
                <th style={{ textAlign: 'center' }}>Anz. Sess.</th>
                <th></th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} onClick={() => { setSelected(e); setEditMode(false) }}
                    style={{ cursor: 'pointer', background: selected?.id === e.id ? 'var(--color-primary-light)' : undefined }}>
                    <td className="primary">{e.name || `Sv_${entries.indexOf(e)+1}`}</td>
                    <td>{fmtDate(e.date)}</td>
                    <td style={{ fontWeight: 600 }}>{Number(e.unitCount ?? 1).toFixed(1)}</td>
                    <td>{e.supervisorName || e.supervisor?.name || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.groupParticipants || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</td>
                    <td style={{ textAlign: 'center' }}>—</td>
                    <td style={{ textAlign: 'center' }}>—</td>
                    <td onClick={e2 => e2.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setSelected(e); setEditMode(true) }}
                          className="btn-ghost" style={{ padding: '2px 4px' }} title="Bearbeiten">
                          <Edit3 style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => del(e.id)} className="btn-ghost"
                          style={{ padding: '2px 4px', color: 'var(--red)' }} title="Löschen">
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail / Bearbeiten Panel */}
        {selected && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editMode ? 'Bearbeiten' : 'Details'} — {selected.name || fmtDate(selected.date)}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {!editMode && (
                  <button onClick={() => setEditMode(true)} className="btn-secondary" style={{ fontSize: 12 }}>
                    <Edit3 style={{ width: 12, height: 12 }} /> Bearbeiten
                  </button>
                )}
                <button onClick={() => { setSelected(null); setEditMode(false) }} className="btn-ghost" style={{ padding: 4 }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {editMode ? (
              <SupervisionForm
                initial={selected}
                onSave={form => update(selected.id, form)}
                onCancel={() => setEditMode(false)}
                saving={savingEdit}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  ['Name', selected.name || '—'],
                  ['Datum', fmtDate(selected.date)],
                  ['Supervisor*in', selected.supervisorName || selected.supervisor?.name || '—'],
                  ['Einheiten', Number(selected.unitCount ?? 1).toFixed(1)],
                  ['Dauer', selected.durationMinutes + ' min'],
                  ['Art', SUPERVISION_TYPES[selected.supervisionType] ?? selected.supervisionType],
                  ['Gruppenteilnehmer', selected.groupParticipants || '—'],
                  ['Fachspezifikum', selected.fachspezifikum ? '✓ Ja' : '✗ Nein'],
                ].map(([l, v]) => (
                  <div key={l} className="field-row">
                    <span className="field-label">{l}</span>
                    <span className="field-value">{v}</span>
                  </div>
                ))}
                {selected.content && (
                  <div style={{ gridColumn: '1/-1' }} className="field-row">
                    <span className="field-label">Notiz</span>
                    <span className="field-value" style={{ whiteSpace: 'pre-wrap' }}>{selected.content}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
