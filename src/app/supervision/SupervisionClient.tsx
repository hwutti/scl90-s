
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, GraduationCap, CheckCircle, Clock, Users } from 'lucide-react'

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}

const SUPERVISION_TYPES: Record<string,string> = {
  INDIVIDUAL: 'Einzelsupervision', GROUP: 'Gruppensupervision', SELF: 'Selbsterfahrung',
}

export function SupervisionClient() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    durationMinutes: 60,
    supervisionType: 'INDIVIDUAL',
    content: '',
    fachspezifikum: true,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch(`/api/supervision?year=${year}`).then(r => r.json())
    setEntries(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await fetch('/api/supervision', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(form),
    })
    setSaving(false); setShowNew(false); load()
  }

  const totalMinutes = entries.reduce((s, e) => s + e.durationMinutes, 0)
  const fachMinutes = entries.filter(e => e.fachspezifikum).reduce((s, e) => s + e.durationMinutes, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)
  const fachHours = (fachMinutes / 60).toFixed(1)
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Supervisionsmodus</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Fachspezifikum & Ausbildungsstunden tracken</p>
        </div>
        <select value={year} onChange={e => setYear(+e.target.value)} className="input" style={{ width: 90 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Einheit erfassen
        </button>
      </div>

      <div style={{ padding: 20, flex: 1 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Einheiten gesamt', value: entries.length, icon: GraduationCap, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
            { label: 'Stunden gesamt', value: totalHours + 'h', icon: Clock, color: 'var(--amber)', bg: 'var(--amber-bg)' },
            { label: 'Fachspezifikum', value: fachHours + 'h', icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)' },
            { label: 'Einzelsupervision', value: entries.filter(e=>e.supervisionType==='INDIVIDUAL').length, icon: Users, color: 'var(--blue)', bg: 'var(--blue-bg)' },
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

        {/* Jahresfortschritt Fachspezifikum */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Fachspezifikum Fortschritt {year}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--surface-panel)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'var(--color-primary)',
                width: `${Math.min(100, (parseFloat(fachHours) / 150) * 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', minWidth: 80, textAlign: 'right' }}>
              {fachHours}h / 150h
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Richtwert: 150 Stunden Fachspezifikum pro Ausbildungsabschnitt (individuelle Anforderungen können abweichen)
          </p>
        </div>

        {/* Entries table */}
        {loading ? <div className="empty-state"><div className="spinner" style={{width:24,height:24}}/></div> :
        entries.length === 0 ? (
          <div className="card" style={{ padding: 32 }}>
            <div className="empty-state">
              <GraduationCap className="empty-state-icon" style={{width:36,height:36}}/>
              <p className="empty-state-text">Noch keine Supervisionseinheiten erfasst.</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr>
                <th>Datum</th><th>Typ</th><th>Dauer</th><th>Fachspez.</th><th>Inhalt</th>
              </tr></thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id}>
                    <td className="primary">{fmtDate(e.date)}</td>
                    <td><span className="badge badge-indigo">{SUPERVISION_TYPES[e.supervisionType]}</span></td>
                    <td>{e.durationMinutes} Min.</td>
                    <td>{e.fachspezifikum
                      ? <span className="badge badge-green">✓ Ja</span>
                      : <span className="badge badge-gray">Nein</span>}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.content || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Supervisionseinheit erfassen</h2>
              <button onClick={() => setShowNew(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="form-grid-2">
                <div><label className="label">Datum *</label>
                  <input type="date" className="input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
                <div><label className="label">Dauer (Minuten)</label>
                  <input type="number" className="input" value={form.durationMinutes} onChange={e=>setForm(f=>({...f,durationMinutes:+e.target.value}))}/>
                </div>
              </div>
              <div><label className="label">Typ</label>
                <select className="input" value={form.supervisionType} onChange={e=>setForm(f=>({...f,supervisionType:e.target.value}))}>
                  {Object.entries(SUPERVISION_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Inhalt / Thema</label>
                <textarea className="input" rows={3} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} style={{resize:'vertical'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--color-primary-light)',borderRadius:8}}>
                <input type="checkbox" id="fachspez" checked={form.fachspezifikum}
                  onChange={e=>setForm(f=>({...f,fachspezifikum:e.target.checked}))}/>
                <label htmlFor="fachspez" style={{fontSize:13,cursor:'pointer',color:'var(--color-primary)',fontWeight:500}}>
                  Zählt für Fachspezifikum
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowNew(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={save} disabled={saving||!form.date} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {saving?'Speichern...':'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
