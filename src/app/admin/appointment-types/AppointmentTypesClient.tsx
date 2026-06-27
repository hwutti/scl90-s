'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Clock, Trash2 } from 'lucide-react'

const PRESETS = [
  { name: 'Erstgespräch',       color: '#7c3aed', durationMin: 60 },
  { name: 'Einzeltherapie',     color: '#166534', durationMin: 50 },
  { name: 'Krisenintervention', color: '#dc2626', durationMin: 60 },
  { name: 'Gruppentherapie',    color: '#0369a1', durationMin: 90 },
  { name: 'Supervision',        color: '#92400e', durationMin: 60 },
  { name: 'Abschlussgespräch',  color: '#475569', durationMin: 50 },
]

export function AppointmentTypesClient({ initial, role }: { initial: any[]; role: string }) {
  const router = useRouter()
  const [types, setTypes] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', color: '#166534', durationMin: 50, description: '', isBlocker: false })
  const [saving, setSaving] = useState(false)

  async function createType() {
    setSaving(true)
    const res = await fetch('/api/appointment-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setTypes(t => [...t, data])
    setSaving(false); setCreating(false)
    setForm({ name: '', color: '#166534', durationMin: 50, description: '', isBlocker: false })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Termintypen</h1>
          <p className="text-slate-400 text-sm mt-0.5">Arten von Terminen definieren, Farben und Dauern festlegen</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="w-4 h-4" /> Neuer Typ</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Farbe', 'Name', 'Dauer', 'Beschreibung', 'Typ', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {types.map(t => (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  <div className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: t.color }} />
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">{t.name}</td>
                <td className="px-4 py-3 text-slate-500"><Clock className="w-3.5 h-3.5 inline mr-1" />{t.durationMin} Min.</td>
                <td className="px-4 py-3 text-slate-400">{t.description || '—'}</td>
                <td className="px-4 py-3">
                  {t.isBlocker
                    ? <span className="badge-gray text-xs">Blockiertermin</span>
                    : <span className="badge-green text-xs">Patiententermin</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={t.isActive ? 'badge-green text-xs' : 'badge-gray text-xs'}>
                    {t.isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Neuer Termintyp</h2>
              <button onClick={() => setCreating(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            {/* Presets */}
            <div className="mb-4">
              <p className="label">Vorlage wählen</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.name} onClick={() => setForm(f => ({...f, ...p}))}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all hover:bg-slate-50"
                    style={{ borderColor: p.color + '80', color: p.color }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="z.B. Krisenintervention" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Farbe</label>
                  <div className="flex gap-2">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))} className="w-10 h-10 rounded-lg border border-slate-200 p-0.5" />
                    <input className="input font-mono text-sm" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))} maxLength={7} />
                  </div>
                </div>
                <div>
                  <label className="label">Dauer (Minuten)</label>
                  <input type="number" className="input" min={5} max={240} step={5} value={form.durationMin}
                    onChange={e => setForm(f => ({...f, durationMin: parseInt(e.target.value)}))} />
                </div>
              </div>
              <div>
                <label className="label">Beschreibung</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isBlocker} onChange={e => setForm(f => ({...f, isBlocker: e.target.checked}))} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-600">Blockiertermin (kein Patientenbezug)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createType} disabled={saving || !form.name} className="btn-primary flex-1 justify-center">
                {saving ? 'Speichern…' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
