'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2, Calendar, Clock } from 'lucide-react'

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']
const ABSENCE_REASONS: Record<string, string> = { HOLIDAY: 'Urlaub', SICK: 'Krank', TRAINING: 'Fortbildung', OTHER: 'Sonstiges' }

export function AvailabilityClient({ slots: initialSlots, absences: initialAbsences }: any) {
  const router = useRouter()
  const [slots, setSlots] = useState(initialSlots)
  const [absences, setAbsences] = useState(initialAbsences)
  const [slotForm, setSlotForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
  const [absenceForm, setAbsenceForm] = useState({ startAt: '', endAt: '', reason: 'HOLIDAY', note: '' })
  const [showSlot, setShowSlot] = useState(false)
  const [showAbsence, setShowAbsence] = useState(false)

  async function addSlot() {
    const res = await fetch('/api/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slotForm),
    })
    const data = await res.json()
    setSlots((s: any[]) => [...s, data])
    setShowSlot(false)
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/availability?id=${id}`, { method: 'DELETE' })
    setSlots((s: any[]) => s.filter(x => x.id !== id))
  }

  async function addAbsence() {
    const res = await fetch('/api/absences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(absenceForm),
    })
    const data = await res.json()
    setAbsences((a: any[]) => [...a, data].sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()))
    setShowAbsence(false)
  }

  async function deleteAbsence(id: string) {
    await fetch(`/api/absences/${id}`, { method: 'DELETE' })
    setAbsences((a: any[]) => a.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Verfügbarkeit & Abwesenheiten</h1>
        <p className="text-slate-400 text-sm mt-0.5">Legen Sie Ihre buchbaren Zeiten und Urlaubsperioden fest</p>
      </div>

      {/* Verfügbarkeitsslots */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Reguläre Arbeitszeiten</h2>
          <button onClick={() => setShowSlot(true)} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Slot hinzufügen</button>
        </div>
        {slots.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Noch keine Verfügbarkeitszeiten definiert</p>
        ) : (
          <div className="space-y-2">
            {slots.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 group">
                <span className="text-sm font-semibold text-slate-700 w-24">{DAYS[s.dayOfWeek]}</span>
                <span className="text-sm text-slate-500">{s.startTime} – {s.endTime} Uhr</span>
                <button onClick={() => deleteSlot(s.id)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abwesenheiten */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4" /> Urlaub & Abwesenheiten</h2>
          <button onClick={() => setShowAbsence(true)} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Abwesenheit</button>
        </div>
        {absences.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Keine Abwesenheiten eingetragen</p>
        ) : (
          <div className="space-y-2">
            {absences.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 group">
                <span className="badge-yellow text-xs">{ABSENCE_REASONS[a.reason]}</span>
                <span className="text-sm text-slate-600">
                  {new Date(a.startAt).toLocaleDateString('de-AT')} – {new Date(a.endAt).toLocaleDateString('de-AT')}
                </span>
                {a.note && <span className="text-xs text-slate-400">· {a.note}</span>}
                <button onClick={() => deleteAbsence(a.id)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot Modal */}
      {showSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Verfügbarkeitszeit</h2>
              <button onClick={() => setShowSlot(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Wochentag</label>
                <select className="input" value={slotForm.dayOfWeek} onChange={e => setSlotForm(f => ({...f, dayOfWeek: parseInt(e.target.value)}))}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Von</label>
                  <input type="time" className="input" value={slotForm.startTime} onChange={e => setSlotForm(f => ({...f, startTime: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Bis</label>
                  <input type="time" className="input" value={slotForm.endTime} onChange={e => setSlotForm(f => ({...f, endTime: e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSlot(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={addSlot} className="btn-primary flex-1 justify-center">Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Abwesenheit Modal */}
      {showAbsence && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Abwesenheit eintragen</h2>
              <button onClick={() => setShowAbsence(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Grund</label>
                <select className="input" value={absenceForm.reason} onChange={e => setAbsenceForm(f => ({...f, reason: e.target.value}))}>
                  {Object.entries(ABSENCE_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Von</label>
                  <input type="date" className="input" value={absenceForm.startAt} onChange={e => setAbsenceForm(f => ({...f, startAt: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Bis</label>
                  <input type="date" className="input" value={absenceForm.endAt} onChange={e => setAbsenceForm(f => ({...f, endAt: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Notiz (optional)</label>
                <input className="input" value={absenceForm.note} onChange={e => setAbsenceForm(f => ({...f, note: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAbsence(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={addAbsence} disabled={!absenceForm.startAt || !absenceForm.endAt} className="btn-primary flex-1 justify-center">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
