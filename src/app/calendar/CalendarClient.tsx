'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, AlertCircle,
  Users, Calendar, LayoutGrid, Clock, Ban, UserX
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
  NO_SHOW: 'bg-red-100 text-red-700 border-red-200',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-200',
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function startOfWeek(d: Date) {
  const c = new Date(d)
  const day = (c.getDay() + 6) % 7
  c.setDate(c.getDate() - day)
  c.setHours(0, 0, 0, 0)
  return c
}

type ViewMode = 'week' | 'month' | 'overview'

interface Appointment {
  id: string; startAt: string; endAt: string; status: string
  type: { name: string; color: string }
  patient?: { firstName: string; lastName: string } | null
  therapist?: { name: string } | null
  isBlocker: boolean; blockerNote?: string
}

interface Props {
  currentUserId: string; role: string
  types: any[]; therapists: any[]; patients: any[]
}

export function CalendarClient({ currentUserId, role, types, therapists, patients }: Props) {
  const [view, setView] = useState<ViewMode>('week')
  const [current, setCurrent] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTherapist, setSelectedTherapist] = useState(currentUserId)
  const [showModal, setShowModal] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [form, setForm] = useState({
    patientId: '', typeId: types[0]?.id ?? '', startAt: '',
    therapistNote: '', patientNote: '', isBlocker: false, blockerNote: '',
    recurrence: false, recurrenceFreq: 'WEEKLY', recurrenceCount: 12,
  })
  const [saving, setSaving] = useState(false)

  // Datumsbereich für aktuellen View
  const getRange = useCallback(() => {
    if (view === 'week') {
      const from = startOfWeek(current)
      const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59)
      return { from, to }
    } else {
      const from = new Date(current.getFullYear(), current.getMonth(), 1)
      const to = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59)
      return { from, to }
    }
  }, [view, current])

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRange()
    const params = new URLSearchParams({
      from: from.toISOString(), to: to.toISOString(),
      ...(selectedTherapist !== 'ALL' && { therapistId: selectedTherapist }),
    })
    const res = await fetch(`/api/appointments?${params}`)
    const data = await res.json()
    setAppointments(Array.isArray(data) ? data.map((a: any) => ({ ...a, startAt: a.startAt, endAt: a.endAt })) : [])
    setLoading(false)
  }, [getRange, selectedTherapist])

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/calendar/stats?therapistId=${selectedTherapist}`)
    setStats(await res.json())
  }, [selectedTherapist])

  useEffect(() => { loadAppointments(); loadStats() }, [loadAppointments, loadStats])

  function navigate(dir: number) {
    const d = new Date(current)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
  }

  async function createAppointment() {
    setSaving(true)
    const type = types.find(t => t.id === form.typeId)
    const payload: any = {
      typeId: form.typeId,
      therapistId: selectedTherapist !== 'ALL' ? selectedTherapist : currentUserId,
      startAt: form.startAt,
      isBlocker: form.isBlocker,
      blockerNote: form.blockerNote || null,
      therapistNote: form.therapistNote || null,
    }
    if (form.patientId) payload.patientId = form.patientId
    if (form.recurrence) {
      const d = new Date(form.startAt)
      payload.recurrence = {
        freq: form.recurrenceFreq,
        dayOfWeek: (d.getDay() + 6) % 7,
        startTime: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        count: form.recurrenceCount,
      }
    }
    await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false); setShowModal(false)
    setForm(f => ({ ...f, startAt: '', patientNote: '', therapistNote: '', blockerNote: '' }))
    loadAppointments()
  }

  async function updateStatus(id: string, status: string, affectSeries = false) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, affectSeries }),
    })
    setSelectedAppt(null); loadAppointments(); loadStats()
  }

  // ── Wochenansicht ──
  const weekStart = startOfWeek(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })
  const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8–18 Uhr

  const apptForDay = (day: Date) =>
    appointments.filter(a => isSameDay(new Date(a.startAt), day))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  // ── Monatsansicht ──
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthDayOffset = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kalender</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {view === 'week'
              ? `${weekDays[0].toLocaleDateString('de-AT', { day:'2-digit', month:'short' })} – ${weekDays[6].toLocaleDateString('de-AT', { day:'2-digit', month:'long', year:'numeric' })}`
              : `${MONTH_LABELS[current.getMonth()]} ${current.getFullYear()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View-Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[['week','Woche',Calendar],['month','Monat',LayoutGrid],['overview','Übersicht',Users]].map(([v,l,I]) => (
              <button key={v as string} onClick={() => setView(v as ViewMode)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                <(I as any) className="w-3.5 h-3.5" />{l as string}
              </button>
            ))}
          </div>
          {/* Therapeuten-Filter (Admin) */}
          {role === 'ADMIN' && (
            <select className="input text-sm py-1.5" value={selectedTherapist}
              onChange={e => setSelectedTherapist(e.target.value)}>
              <option value="ALL">Alle Therapeuten</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrent(new Date())} className="btn-secondary px-3 py-2 text-xs">Heute</button>
            <button onClick={() => navigate(1)}  className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Termin
          </button>
        </div>
      </div>

      {/* KPI-Zeile */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Bevorstehend',  value: stats.upcoming,  color: 'text-indigo-600' },
            { label: 'Ausstehend',    value: stats.pending,   color: 'text-amber-600' },
            { label: 'Warteliste',    value: stats.waitlist,  color: 'text-slate-600' },
            { label: 'No-Show (Monat)', value: stats.noShow, color: 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="card p-3 text-center">
              <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── WOCHENANSICHT ── */}
      {view === 'week' && (
        <div className="card overflow-hidden">
          {/* Wochentag-Header */}
          <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="p-2" />
            {weekDays.map((d, i) => {
              const isToday = isSameDay(d, new Date())
              return (
                <div key={i} className={cn('p-2 text-center border-l border-slate-50', isToday && 'bg-indigo-50')}>
                  <p className="text-xs text-slate-400">{DAY_LABELS[i]}</p>
                  <p className={cn('text-base font-semibold', isToday ? 'text-indigo-600' : 'text-slate-700')}>
                    {d.getDate()}
                  </p>
                </div>
              )
            })}
          </div>
          {/* Stunden-Gitter */}
          <div className="overflow-y-auto" style={{ maxHeight: '560px' }}>
            {hours.map(h => (
              <div key={h} className="grid border-b border-slate-50" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: '52px' }}>
                <div className="px-2 pt-1">
                  <span className="text-xs text-slate-300">{h}:00</span>
                </div>
                {weekDays.map((d, di) => {
                  const dayAppts = apptForDay(d).filter(a => {
                    const start = new Date(a.startAt)
                    return start.getHours() === h
                  })
                  return (
                    <div key={di} className={cn('border-l border-slate-50 p-0.5 relative', isSameDay(d, new Date()) && 'bg-indigo-50/30')}>
                      {dayAppts.map(a => (
                        <button key={a.id}
                          onClick={() => setSelectedAppt(a)}
                          className="w-full text-left rounded-lg p-1.5 mb-0.5 text-xs border transition-all hover:opacity-80"
                          style={{ backgroundColor: a.type.color + '20', borderColor: a.type.color + '60', color: a.type.color }}>
                          <p className="font-semibold truncate">{formatTime(new Date(a.startAt))} {a.isBlocker ? a.blockerNote || 'Blockiert' : a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : ''}</p>
                          <p className="opacity-70 truncate">{a.type.name}</p>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONATSANSICHT ── */}
      {view === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_LABELS.map(d => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: monthDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 border-b border-r border-slate-50 bg-slate-50/50" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const d = new Date(current.getFullYear(), current.getMonth(), day)
              const dayAppts = apptForDay(d)
              const isToday = isSameDay(d, new Date())
              return (
                <div key={day} className={cn('h-24 border-b border-r border-slate-50 p-1 relative', isToday && 'bg-indigo-50/30')}>
                  <span className={cn('text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-indigo-600 text-white' : 'text-slate-600')}>
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {dayAppts.slice(0, 3).map(a => (
                      <button key={a.id} onClick={() => setSelectedAppt(a)}
                        className="w-full text-left rounded px-1 py-0.5 text-xs truncate"
                        style={{ backgroundColor: a.type.color + '25', color: a.type.color }}>
                        {formatTime(new Date(a.startAt))} {a.patient ? `${a.patient.lastName}` : a.isBlocker ? 'Blockiert' : a.type.name}
                      </button>
                    ))}
                    {dayAppts.length > 3 && (
                      <p className="text-xs text-slate-400 pl-1">+{dayAppts.length - 3} weitere</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PRAXISÜBERSICHT ── */}
      {view === 'overview' && (
        <div className="card overflow-hidden">
          <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `120px repeat(${therapists.length}, 1fr)` }}>
            <div className="p-3" />
            {therapists.map(t => (
              <div key={t.id} className="p-3 text-center border-l border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mx-auto mb-1">
                  {t.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                </div>
                <p className="text-xs font-medium text-slate-700 truncate">{t.name}</p>
              </div>
            ))}
          </div>
          {weekDays.map((d, di) => (
            <div key={di} className="grid border-b border-slate-50"
              style={{ gridTemplateColumns: `120px repeat(${therapists.length}, 1fr)` }}>
              <div className={cn('p-3', isSameDay(d, new Date()) && 'bg-indigo-50')}>
                <p className="text-xs text-slate-400">{DAY_LABELS[di]}</p>
                <p className="text-sm font-semibold text-slate-700">{d.getDate()}. {MONTH_LABELS[d.getMonth()].slice(0,3)}</p>
              </div>
              {therapists.map(t => {
                const ta = appointments.filter(a =>
                  isSameDay(new Date(a.startAt), d) && a.therapist?.name === t.name
                )
                return (
                  <div key={t.id} className="p-1.5 border-l border-slate-50 min-h-12">
                    {ta.map(a => (
                      <button key={a.id} onClick={() => setSelectedAppt(a)}
                        className="w-full text-left text-xs rounded px-1.5 py-1 mb-0.5 truncate border"
                        style={{ backgroundColor: a.type.color + '20', borderColor: a.type.color + '50', color: a.type.color }}>
                        {formatTime(new Date(a.startAt))} {a.patient ? `${a.patient.lastName}` : 'Blockiert'}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: Termin anlegen ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Termin anlegen</h2>
              <button onClick={() => setShowModal(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Termintyp</label>
                <select className="input" value={form.typeId} onChange={e => setForm(f => ({...f, typeId: e.target.value}))}>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.durationMin} Min.)</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isBlocker}
                  onChange={e => setForm(f => ({...f, isBlocker: e.target.checked}))} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-600">Blockiertermin (kein Patient)</span>
              </label>
              {form.isBlocker ? (
                <div>
                  <label className="label">Grund</label>
                  <input className="input" placeholder="z.B. Supervision, Verwaltung"
                    value={form.blockerNote} onChange={e => setForm(f => ({...f, blockerNote: e.target.value}))} />
                </div>
              ) : (
                <div>
                  <label className="label">Patient</label>
                  <select className="input" value={form.patientId}
                    onChange={e => setForm(f => ({...f, patientId: e.target.value}))}>
                    <option value="">— kein Patient —</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>)}
                  </select>
                </div>
              )}
              {role === 'ADMIN' && (
                <div>
                  <label className="label">Therapeut</label>
                  <select className="input" value={selectedTherapist !== 'ALL' ? selectedTherapist : currentUserId}
                    onChange={e => setSelectedTherapist(e.target.value)}>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Datum & Uhrzeit</label>
                <input type="datetime-local" className="input" value={form.startAt}
                  onChange={e => setForm(f => ({...f, startAt: e.target.value}))} />
              </div>
              <div>
                <label className="label">Interne Notiz</label>
                <textarea className="input" rows={2} value={form.therapistNote}
                  onChange={e => setForm(f => ({...f, therapistNote: e.target.value}))}
                  placeholder="Nur für Therapeuten sichtbar" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.recurrence}
                  onChange={e => setForm(f => ({...f, recurrence: e.target.checked}))} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-600">Terminserie erstellen</span>
              </label>
              {form.recurrence && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className="label">Frequenz</label>
                    <select className="input" value={form.recurrenceFreq}
                      onChange={e => setForm(f => ({...f, recurrenceFreq: e.target.value}))}>
                      <option value="WEEKLY">Wöchentlich</option>
                      <option value="BIWEEKLY">14-tägig</option>
                      <option value="MONTHLY">Monatlich</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Anzahl Termine</label>
                    <input type="number" className="input" min={1} max={104} value={form.recurrenceCount}
                      onChange={e => setForm(f => ({...f, recurrenceCount: parseInt(e.target.value)}))} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={createAppointment} disabled={saving || !form.startAt || !form.typeId}
                className="btn-primary flex-1 justify-center">
                {saving ? 'Speichern…' : form.recurrence ? 'Serie anlegen' : 'Termin anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL-MODAL: Termin anzeigen/bearbeiten ── */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAppt.type.color }} />
                <h2 className="font-bold text-slate-800">{selectedAppt.type.name}</h2>
              </div>
              <button onClick={() => setSelectedAppt(null)} className="btn-secondary p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Zeit</span>
                <span className="font-medium">
                  {new Date(selectedAppt.startAt).toLocaleDateString('de-AT', { weekday:'short', day:'2-digit', month:'short' })}
                  {' '}{formatTime(new Date(selectedAppt.startAt))} – {formatTime(new Date(selectedAppt.endAt))}
                </span>
              </div>
              {selectedAppt.patient && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Patient</span>
                  <span className="font-medium">{selectedAppt.patient.firstName} {selectedAppt.patient.lastName}</span>
                </div>
              )}
              {selectedAppt.therapist && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Therapeut</span>
                  <span className="font-medium">{selectedAppt.therapist.name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status</span>
                <span className={cn('badge text-xs px-2 py-0.5 rounded-full border', STATUS_COLOR[selectedAppt.status])}>
                  {selectedAppt.status === 'PENDING' ? 'Ausstehend'
                   : selectedAppt.status === 'CONFIRMED' ? 'Bestätigt'
                   : selectedAppt.status === 'CANCELLED' ? 'Abgesagt'
                   : selectedAppt.status === 'NO_SHOW' ? 'No-Show'
                   : 'Abgeschlossen'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedAppt.status === 'PENDING' && (
                <button onClick={() => updateStatus(selectedAppt.id, 'CONFIRMED')}
                  className="btn-primary flex-1 justify-center text-xs py-2">
                  <Check className="w-3.5 h-3.5" /> Bestätigen
                </button>
              )}
              {['PENDING','CONFIRMED'].includes(selectedAppt.status) && (
                <>
                  <button onClick={() => updateStatus(selectedAppt.id, 'NO_SHOW')}
                    className="btn-danger flex-1 justify-center text-xs py-2">
                    <UserX className="w-3.5 h-3.5" /> No-Show
                  </button>
                  <button onClick={() => updateStatus(selectedAppt.id, 'CANCELLED')}
                    className="btn-secondary flex-1 justify-center text-xs py-2">
                    <Ban className="w-3.5 h-3.5" /> Absagen
                  </button>
                  {selectedAppt.status === 'CONFIRMED' && (
                    <button onClick={() => updateStatus(selectedAppt.id, 'COMPLETED')}
                      className="btn-secondary w-full justify-center text-xs py-2">
                      <Check className="w-3.5 h-3.5" /> Als abgeschlossen markieren
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
