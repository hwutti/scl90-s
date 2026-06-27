'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, User, AlertCircle, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PatientRow {
  id: string
  firstName: string
  lastName: string
  dob: string
  gender: string
  active: boolean
  patientUser: { pin: string } | null
  assessments: Array<{
    status: string
    result: { isClinicalCase: boolean; scores: any } | null
  }>
}

interface Instrument { id: string; code: string; shortName: string }

interface Props {
  patients: PatientRow[]
  instruments: Instrument[]
  role: string
}

const GENDER_LABEL: Record<string, string> = { MALE: 'männlich', FEMALE: 'weiblich', DIVERSE: 'divers' }

function calcAge(dob: string) {
  const d = new Date(dob + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
  return age
}

export function PatientsListClient({ patients, instruments, role }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newPin, setNewPin] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', gender: 'MALE',
    phone: '', email: '', insuranceProvider: '', referralSource: '',
    createLogin: true,
  })

  const filtered = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  async function createPatient() {
    setLoading(true)
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.id) {
      if (data.generatedPin) setNewPin(data.generatedPin)
      else { setCreating(false); router.refresh() }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patienten</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patients.length} Patienten gesamt</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Neuer Patient
        </button>
      </div>

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Patient suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Patientenliste */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Keine Patienten gefunden.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(p => {
              const lastAssessment = p.assessments[0]
              const isClinical = lastAssessment?.result?.isClinicalCase
              const scores = lastAssessment?.result?.scores as any
              const gsiT = scores?.gsiT ? Math.round(scores.gsiT) : null
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/patients/${p.id}`)}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                    isClinical === true ? 'bg-red-100 text-red-700'
                    : isClinical === false ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                  )}>
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{p.lastName}, {p.firstName}</p>
                    <p className="text-xs text-slate-400">
                      {GENDER_LABEL[p.gender]} · {calcAge(p.dob)} J. · {p.dob}
                      {p.patientUser && <span className="ml-2 text-indigo-500">PIN: {p.patientUser.pin}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {lastAssessment ? (
                      <div className="text-right">
                        {isClinical === true && (
                          <span className="badge-red text-xs flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> auffällig
                          </span>
                        )}
                        {isClinical === false && (
                          <span className="badge-green text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> unauffällig
                          </span>
                        )}
                        {gsiT && <p className="text-xs text-slate-400 mt-0.5">GSI T={gsiT}</p>}
                      </div>
                    ) : (
                      <span className="badge-gray text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> kein Test
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Neuer Patient Modal */}
      {creating && !newPin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Neuen Patienten anlegen</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vorname *</label>
                  <input className="input" value={form.firstName}
                    onChange={e => setForm(f => ({...f, firstName: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Nachname *</label>
                  <input className="input" value={form.lastName}
                    onChange={e => setForm(f => ({...f, lastName: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Geburtsdatum *</label>
                  <input type="date" className="input" value={form.dob}
                    onChange={e => setForm(f => ({...f, dob: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Geschlecht *</label>
                  <select className="input" value={form.gender}
                    onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
                    <option value="MALE">männlich</option>
                    <option value="FEMALE">weiblich</option>
                    <option value="DIVERSE">divers</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefon</label>
                  <input className="input" value={form.phone}
                    onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div>
                  <label className="label">E-Mail</label>
                  <input type="email" className="input" value={form.email}
                    onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Versicherungsträger</label>
                  <input className="input" value={form.insuranceProvider}
                    onChange={e => setForm(f => ({...f, insuranceProvider: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Zuweisung durch</label>
                  <input className="input" value={form.referralSource}
                    onChange={e => setForm(f => ({...f, referralSource: e.target.value}))} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.createLogin}
                  onChange={e => setForm(f => ({...f, createLogin: e.target.checked}))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-600">PIN-Login für Patient erstellen</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button
                onClick={createPatient}
                disabled={loading || !form.firstName || !form.lastName || !form.dob}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? 'Anlegen…' : 'Patient anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN-Anzeige nach Anlegen */}
      {newPin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">Patient angelegt</h2>
            <p className="text-slate-500 text-sm mb-4">PIN für den Patienten-Login:</p>
            <div className="text-4xl font-mono font-bold text-indigo-600 bg-indigo-50 rounded-xl py-4 mb-4 tracking-widest">
              {newPin}
            </div>
            <p className="text-xs text-slate-400 mb-4">Bitte dem Patienten mitteilen und sicher aufbewahren.</p>
            <button onClick={() => { setNewPin(null); setCreating(false); router.refresh() }} className="btn-primary w-full justify-center">
              Zur Patientenakte
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
