'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check } from 'lucide-react'

interface UserRow {
  id: string; name: string | null; email: string | null
  role: string; pin: string | null; active: boolean
  createdAt: string; _count: { sessions: number }
}

export function UsersClient({ users, currentRole }: { users: UserRow[]; currentRole: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'PATIENT' })
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function createUser() {
    setLoading(true)
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setCreating(false)
    router.refresh()
  }

  function copyPin(pin: string, id: string) {
    navigator.clipboard.writeText(pin)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Benutzerverwaltung</h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} Benutzer</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Benutzer anlegen
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Neuer Benutzer</h2>
            <div className="space-y-3">
              <div><label className="label">Name</label>
                <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
              <div><label className="label">Rolle</label>
                <select className="input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  <option value="PATIENT">Patient (PIN-Login)</option>
                  <option value="THERAPIST">Therapeut</option>
                  {currentRole === 'ADMIN' && <option value="ADMIN">Admin</option>}
                </select>
              </div>
              {form.role !== 'PATIENT' && <>
                <div><label className="label">E-Mail</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
                <div><label className="label">Passwort</label>
                  <input type="password" className="input" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} /></div>
              </>}
              {form.role === 'PATIENT' && <p className="text-xs text-slate-400">PIN wird automatisch generiert.</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createUser} disabled={loading || !form.name} className="btn-primary flex-1 justify-center">
                {loading ? 'Erstelle…' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Name','Rolle','E-Mail / PIN','Erhebungen','Aktiv','Angelegt'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{u.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={u.role === 'ADMIN' ? 'badge-red' : u.role === 'THERAPIST' ? 'badge-blue' : 'badge-gray'}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.pin ? (
                    <button onClick={() => copyPin(u.pin!, u.id)} className="flex items-center gap-1.5 font-mono text-sm bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors">
                      {copiedId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      {u.pin}
                    </button>
                  ) : (
                    <span className="text-slate-500">{u.email ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">{u._count.sessions}</td>
                <td className="px-4 py-3">
                  {u.active ? <span className="badge-green">Aktiv</span> : <span className="badge-red">Gesperrt</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('de-AT')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
