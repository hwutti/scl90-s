'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check, Edit3, X, Save, RefreshCw, Eye, EyeOff, UserX, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserRow {
  id: string; name: string | null; email: string | null
  role: string; pin: string | null; active: boolean
  createdAt: string; _count: { createdPatients: number }
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'badge-red', THERAPIST: 'badge-blue', PATIENT: 'badge-gray'
}
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', THERAPIST: 'Therapeut', PATIENT: 'Patient'
}

export function UsersClient({ users: initialUsers, currentRole }: { users: UserRow[]; currentRole: string }) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [creating, setCreating] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [newPin, setNewPin] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'PATIENT' })
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', active: true })

  function copyPin(pin: string, id: string) {
    navigator.clipboard.writeText(pin)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({ name: u.name ?? '', email: u.email ?? '', password: '', active: u.active })
    setNewPin(null)
    setShowPw(false)
  }

  async function createUser() {
    setLoading(true)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    setLoading(false)
    setCreating(false)
    setCreateForm({ name: '', email: '', password: '', role: 'PATIENT' })
    if (data.pin) setNewPin(data.pin)
    router.refresh()
  }

  async function saveEdit() {
    if (!editUser) return
    setLoading(true)
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    setLoading(false)
    if (data.newPin) setNewPin(data.newPin)
    setUsers(u => u.map(x => x.id === editUser.id
      ? { ...x, name: editForm.name, email: editForm.email, active: editForm.active }
      : x
    ))
    setEditUser(null)
  }

  async function regeneratePin(userId: string) {
    setLoading(true)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regeneratePin: true }),
    })
    const data = await res.json()
    setLoading(false)
    setNewPin(data.newPin)
    setUsers(u => u.map(x => x.id === userId ? { ...x, pin: data.newPin } : x))
  }

  async function toggleActive(u: UserRow) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    setUsers(us => us.map(x => x.id === u.id ? { ...x, active: !u.active } : x))
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

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Name','Rolle','E-Mail / PIN','Patienten','Status','Angelegt',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className={cn('hover:bg-slate-50', !u.active && 'opacity-50')}>
                <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-4 py-3">
                  {u.pin ? (
                    <button onClick={() => copyPin(u.pin!, u.id)}
                      className="flex items-center gap-1.5 font-mono text-sm bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors">
                      {copiedId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      {u.pin}
                    </button>
                  ) : (
                    <span className="text-slate-500">{u.email ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-slate-500">{u._count.createdPatients}</td>
                <td className="px-4 py-3">
                  {u.active
                    ? <span className="badge-green">Aktiv</span>
                    : <span className="badge-red">Gesperrt</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('de-AT')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {u.pin && (
                      <button onClick={() => regeneratePin(u.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Neuen PIN generieren">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => toggleActive(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title={u.active ? 'Sperren' : 'Aktivieren'}>
                      {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Neuer Benutzer Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Neuer Benutzer</h2>
              <button onClick={() => setCreating(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={createForm.name}
                  onChange={e => setCreateForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">Rolle *</label>
                <select className="input" value={createForm.role}
                  onChange={e => setCreateForm(f => ({...f, role: e.target.value}))}>
                  <option value="PATIENT">Patient (PIN-Login)</option>
                  <option value="THERAPIST">Therapeut</option>
                  {currentRole === 'ADMIN' && <option value="ADMIN">Admin</option>}
                </select>
              </div>
              {createForm.role !== 'PATIENT' ? (
                <>
                  <div>
                    <label className="label">E-Mail *</label>
                    <input type="email" className="input" value={createForm.email}
                      onChange={e => setCreateForm(f => ({...f, email: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Passwort *</label>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} className="input pr-10" value={createForm.password}
                        onChange={e => setCreateForm(f => ({...f, password: e.target.value}))} />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
                  PIN wird automatisch generiert und nach dem Anlegen angezeigt.
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createUser} disabled={loading || !createForm.name}
                className="btn-primary flex-1 justify-center">
                {loading ? 'Erstelle…' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bearbeiten Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Benutzer bearbeiten</h2>
              <button onClick={() => setEditUser(null)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={editForm.name}
                  onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
              </div>
              {editUser.role !== 'PATIENT' && (
                <>
                  <div>
                    <label className="label">E-Mail</label>
                    <input type="email" className="input" value={editForm.email}
                      onChange={e => setEditForm(f => ({...f, email: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Neues Passwort (leer = unverändert)</label>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} className="input pr-10"
                        placeholder="Neues Passwort eingeben…"
                        value={editForm.password}
                        onChange={e => setEditForm(f => ({...f, password: e.target.value}))} />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {editUser.role === 'PATIENT' && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Aktueller PIN</p>
                    <p className="font-mono font-bold text-slate-800">{editUser.pin ?? '—'}</p>
                  </div>
                  <button onClick={() => regeneratePin(editUser.id)}
                    className="btn-secondary text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Neuer PIN
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-50">
                <input type="checkbox" checked={editForm.active}
                  onChange={e => setEditForm(f => ({...f, active: e.target.checked}))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-700">Benutzer aktiv (Zugang erlaubt)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditUser(null)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={saveEdit} disabled={loading}
                className="btn-primary flex-1 justify-center">
                <Save className="w-4 h-4" />
                {loading ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neuer PIN Modal */}
      {newPin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-7 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-1">PIN</h2>
            <p className="text-sm text-slate-400 mb-5">Bitte dem Patienten mitteilen:</p>
            <div className="text-4xl font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100
                            rounded-2xl py-5 tracking-[0.3em] mb-5 select-all">
              {newPin}
            </div>
            <button onClick={() => { copyPin(newPin, 'modal'); setNewPin(null) }} className="btn-primary w-full justify-center mb-2">
              <Copy className="w-4 h-4" /> Kopieren & Schließen
            </button>
            <button onClick={() => setNewPin(null)} className="btn-secondary w-full justify-center">
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
