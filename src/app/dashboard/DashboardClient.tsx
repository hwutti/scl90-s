'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, TrendingUp, ClipboardCheck, AlertCircle, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionRow {
  id: string; patientName: string; patientGender: string; status: string
  occasion: string; startedAt: string; completedAt: string | null
  gsi: number | null; gsiT: number | null; isClinicalCase: boolean | null; answeredTotal: number
}
interface Props { sessions: SessionRow[]; role: string; userId: string }

function RiskBadge({ gsi }: { gsi: number | null }) {
  if (gsi === null) return <span className="badge-gray">--</span>
  if (gsi < 0.5)   return <span className="badge-green">Gruen {gsi.toFixed(2)}</span>
  if (gsi < 1.5)   return <span className="badge-yellow">Gelb {gsi.toFixed(2)}</span>
  return <span className="badge-red">Rot {gsi.toFixed(2)}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string>   = { IN_PROGRESS: "badge-blue", COMPLETED: "badge-yellow", SCORED: "badge-green", LOCKED: "badge-gray", ASSIGNED: "badge-gray" }
  const labels: Record<string, string> = { IN_PROGRESS: "Lauft", COMPLETED: "Abgeschlossen", SCORED: "Ausgewertet", LOCKED: "Gesperrt", ASSIGNED: "Zugewiesen" }
  return <span className={map[status] ?? "badge-gray"}>{labels[status] ?? status}</span>
}

export function DashboardClient({ sessions, role }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ patientName: "", patientGender: "", patientDob: "", occasion: "" })
  const [loading, setLoading] = useState(false)

  const scored   = sessions.filter(s => s.status === "SCORED" || s.status === "LOCKED")
  const avgGsi   = scored.length ? scored.reduce((a, s) => a + (s.gsi ?? 0), 0) / scored.length : null
  const clinical = scored.filter(s => s.isClinicalCase).length

  async function createSession() {
    setLoading(true)
    const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const data = await res.json()
    setLoading(false)
    if (data.id) router.push("/session/" + data.id)
  }

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div className="flex-1">
          <h1 className="page-title">SCL-90-S Uebersicht</h1>
        </div>
        {role !== "PATIENT" && (
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Neue Erhebung
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Gesamt", value: sessions.length, color: "var(--color-primary)", bg: "var(--color-primary-light)" },
            { label: "Ausgewertet", value: scored.length, color: "var(--green)", bg: "var(--green-bg)" },
            { label: "Klinisch auffaellig", value: clinical, color: "var(--red)", bg: "var(--red-bg)" },
            { label: "Durchschnitt GSI", value: avgGsi?.toFixed(2) ?? "--", color: "var(--yellow)", bg: "var(--yellow-bg)" },
          ].map(kpi => (
            <div key={kpi.label} className="stat-card">
              <div className="stat-value" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="stat-label">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alle Erhebungen</span>
            <span className="badge-gray">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <ClipboardCheck className="w-10 h-10 empty-state-icon" />
              <p className="empty-state-text">Noch keine Erhebungen vorhanden.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Patient", "Anlass", "Status", "Gestartet", "GSI", "Klinisch", ""].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}
                      onClick={() => router.push(s.status === "IN_PROGRESS" ? "/session/" + s.id : "/session/" + s.id + "/results")}>
                      <td className="td-primary">{s.patientName}</td>
                      <td>{s.occasion || "--"}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>{s.startedAt}</td>
                      <td><RiskBadge gsi={s.gsi} /></td>
                      <td>
                        {s.isClinicalCase === null ? <span className="badge-gray">--</span>
                          : s.isClinicalCase ? <span className="badge-red">Ja</span>
                          : <span className="badge-green">Nein</span>}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Neue Erhebung</h2>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Patientenname</label>
                <input className="input" placeholder="Vorname Nachname"
                  value={form.patientName} onChange={e => setForm(f => ({...f, patientName: e.target.value}))} />
              </div>
              <div className="form-row-2">
                <div>
                  <label className="label">Geschlecht</label>
                  <select className="input" value={form.patientGender} onChange={e => setForm(f => ({...f, patientGender: e.target.value}))}>
                    <option value="">-- waehlen --</option>
                    <option value="maennlich">maennlich</option>
                    <option value="weiblich">weiblich</option>
                    <option value="divers">divers</option>
                  </select>
                </div>
                <div>
                  <label className="label">Geburtsdatum</label>
                  <input type="date" className="input" value={form.patientDob} onChange={e => setForm(f => ({...f, patientDob: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Anlass</label>
                <input className="input" placeholder="z.B. Ersterhebung" value={form.occasion} onChange={e => setForm(f => ({...f, occasion: e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createSession} disabled={loading || !form.patientName} className="btn-primary flex-1 justify-center">
                {loading ? "Erstelle..." : "Erhebung starten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
