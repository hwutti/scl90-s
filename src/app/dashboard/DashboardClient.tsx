'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, TrendingUp, ClipboardCheck, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionRow {
  id: string
  patientName: string
  patientGender: string
  status: string
  occasion: string
  startedAt: string
  completedAt: string | null
  gsi: number | null
  gsiT: number | null
  isClinicalCase: boolean | null
  answeredTotal: number
}

interface Props {
  sessions: SessionRow[]
  role: string
  userId: string
}

function RiskBadge({ gsi }: { gsi: number | null }) {
  if (gsi === null) return <span className="badge-gray">—</span>
  if (gsi < 0.5)  return <span className="badge-green">Grün {gsi.toFixed(2)}</span>
  if (gsi < 1.5)  return <span className="badge-yellow">Gelb {gsi.toFixed(2)}</span>
  return <span className="badge-red">Rot {gsi.toFixed(2)}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    IN_PROGRESS: 'badge-blue',
    COMPLETED:   'badge-yellow',
    SCORED:      'badge-green',
    LOCKED:      'badge-gray',
  }
  const labels: Record<string, string> = {
    IN_PROGRESS: 'Läuft',
    COMPLETED:   'Abgeschlossen',
    SCORED:      'Ausgewertet',
    LOCKED:      'Gesperrt',
  }
  return <span className={map[status] ?? 'badge-gray'}>{labels[status] ?? status}</span>
}

export function DashboardClient({ sessions, role }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ patientName: '', patientGender: '', patientDob: '', occasion: '' })
  const [loading, setLoading] = useState(false)

  const scored  = sessions.filter(s => s.status === 'SCORED' || s.status === 'LOCKED')
  const avgGsi  = scored.length ? scored.reduce((a, s) => a + (s.gsi ?? 0), 0) / scored.length : null
  const clinical = scored.filter(s => s.isClinicalCase).length

  async function createSession() {
    setLoading(true)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.id) router.push(`/session/${data.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Übersicht</h1>
          <p className="text-slate-500 text-sm mt-0.5">SCL-90-S Erhebungen</p>
        </div>
        {role !== 'PATIENT' && (
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Neue Erhebung
          </button>
        )}
      </div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Gesamt', value: sessions.length, icon: ClipboardCheck, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Ausgewertet', value: scored.length, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Klinisch auffällig', value: clinical, icon: AlertCircle, color: 'text-red-600 bg-red-50' },
          { label: 'Ø GSI', value: avgGsi?.toFixed(2) ?? '—', icon: Clock, color: 'text-amber-600 bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className={cn('inline-flex p-2 rounded-xl mb-2', kpi.color)}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Neue Erhebung Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Neue Erhebung anlegen</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Patientenname</label>
                <input className="input" placeholder="Vorname Nachname"
                  value={form.patientName} onChange={e => setForm(f => ({...f, patientName: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Geschlecht</label>
                  <select className="input" value={form.patientGender}
                    onChange={e => setForm(f => ({...f, patientGender: e.target.value}))}>
                    <option value="">— wählen —</option>
                    <option value="männlich">männlich</option>
                    <option value="weiblich">weiblich</option>
                    <option value="divers">divers</option>
                  </select>
                </div>
                <div>
                  <label className="label">Geburtsdatum</label>
                  <input type="date" className="input" value={form.patientDob}
                    onChange={e => setForm(f => ({...f, patientDob: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Anlass</label>
                <input className="input" placeholder="z.B. Ersterhebung, Verlauf Woche 4"
                  value={form.occasion} onChange={e => setForm(f => ({...f, occasion: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createSession} disabled={loading || !form.patientName} className="btn-primary flex-1 justify-center">
                {loading ? 'Erstelle…' : 'Erhebung starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Alle Erhebungen</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Noch keine Erhebungen vorhanden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Patient', 'Anlass', 'Status', 'Gestartet', 'GSI', 'Klinisch', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(s.status === 'IN_PROGRESS' ? `/session/${s.id}` : `/session/${s.id}/results`)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.patientName}</td>
                    <td className="px-4 py-3 text-slate-500">{s.occasion || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.startedAt}</td>
                    <td className="px-4 py-3"><RiskBadge gsi={s.gsi} /></td>
                    <td className="px-4 py-3">
                      {s.isClinicalCase === null ? <span className="badge-gray">—</span>
                        : s.isClinicalCase ? <span className="badge-red">Ja</span>
                        : <span className="badge-green">Nein</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
