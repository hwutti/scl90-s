'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Calendar, LayoutGrid, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHolidayMap } from '@/lib/holidays'
import type { Holiday } from '@/lib/holidays'

const DAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So']
const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

type ViewMode = 'week' | 'month' | 'overview'

interface Appt {
  id: string
  startAt: string
  endAt: string
  status: string
  type: { name: string; color: string }
  patient?: { firstName: string; lastName: string } | null
  therapist?: { name: string } | null
  isBlocker: boolean
  blockerNote?: string
}

interface Props {
  currentUserId: string
  role: string
  types: any[]
  therapists: any[]
  patients: any[]
  bundesland: string
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function getWeekStart(d: Date): Date {
  const c = new Date(d)
  const dow = (c.getDay() + 6) % 7
  c.setDate(c.getDate() - dow)
  c.setHours(0, 0, 0, 0)
  return c
}

export function CalendarClient({ currentUserId, role, types, therapists, patients, bundesland }: Props) {
  const router = useRouter()
  const today = new Date()

  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [appointments, setAppointments] = useState<Appt[]>([])
  const [selectedTherapist, setSelectedTherapist] = useState(currentUserId)
  const [stats, setStats] = useState<any>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const year = current.getFullYear()
  const hmap = new Map([
    ...getHolidayMap(year - 1, bundesland),
    ...getHolidayMap(year, bundesland),
    ...getHolidayMap(year + 1, bundesland),
  ])

  const getRange = useCallback(() => {
    if (view === 'week') {
      const from = getWeekStart(current)
      const to = new Date(from)
      to.setDate(from.getDate() + 6)
      to.setHours(23, 59, 59)
      return { from, to }
    }
    const from = new Date(current.getFullYear(), current.getMonth(), 1)
    const to = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59)
    return { from, to }
  }, [view, current])

  const load = useCallback(async () => {
    const { from, to } = getRange()
    const p = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
    if (selectedTherapist !== 'ALL') p.set('therapistId', selectedTherapist)
    const res = await fetch(`/api/appointments?${p}`)
    const data = await res.json()
    setAppointments(Array.isArray(data) ? data : [])
  }, [getRange, selectedTherapist])

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/calendar/stats?therapistId=${selectedTherapist}`)
    setStats(await res.json())
  }, [selectedTherapist])

  useEffect(() => { load(); loadStats() }, [load, loadStats])

  function navigate(dir: number) {
    const d = new Date(current)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
  }

  function apptForDay(day: Date): Appt[] {
    return appointments
      .filter(a => sameDay(new Date(a.startAt), day))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  }

  function getHolidays(d: Date): Holiday[] {
    return hmap.get(fmtDate(d)) ?? []
  }

  async function dropOnDate(dateStr: string) {
    if (!dragId) return
    const appt = appointments.find(a => a.id === dragId)
    if (!appt) return
    const orig = new Date(appt.startAt)
    const parts = dateStr.split('-').map(Number)
    const newStart = new Date(parts[0], parts[1] - 1, parts[2], orig.getHours(), orig.getMinutes())
    setDragId(null)
    setDragOver(null)
    await fetch(`/api/appointments/${dragId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: newStart.toISOString() }),
    })
    await Promise.all([load(), loadStats()])
  }

  function newApptUrl(dateStr: string): string {
    const tid = selectedTherapist !== 'ALL' ? selectedTherapist : currentUserId
    return `/appointments/new?date=${dateStr}&therapistId=${tid}`
  }

  // Woche
  const weekStart = getWeekStart(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const hours = Array.from({ length: 12 }, (_, i) => i + 7)

  // Monat
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthOffset = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()

  const headerLabel = view === 'week'
    ? weekDays[0].toLocaleDateString('de-AT', { day: '2-digit', month: 'short' }) +
      ' – ' +
      weekDays[6].toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' })
    : MONTH_LABELS[current.getMonth()] + ' ' + current.getFullYear()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Kalender</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-[var(--surface-panel)] p-1">
            {(['week', 'month', 'overview'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === v ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]')}>
                {v === 'week' && <Calendar className="w-3.5 h-3.5" />}
                {v === 'month' && <LayoutGrid className="w-3.5 h-3.5" />}
                {v === 'overview' && <Users className="w-3.5 h-3.5" />}
                {v === 'week' ? 'Woche' : v === 'month' ? 'Monat' : 'Übersicht'}
              </button>
            ))}
          </div>
          {role === 'ADMIN' && (
            <select className="input text-sm py-1.5" value={selectedTherapist}
              onChange={e => setSelectedTherapist(e.target.value)}>
              <option value="ALL">Alle Therapeuten</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrent(new Date())} className="btn-secondary px-3 py-2 text-xs font-medium">Heute</button>
            <button onClick={() => navigate(1)} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => router.push(newApptUrl(fmtDate(today)))} className="btn-primary">
            <Plus className="w-4 h-4" /> Termin
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Bevorstehend', value: stats.upcoming, color: 'text-indigo-600' },
            { label: 'Ausstehend',   value: stats.pending,  color: 'text-amber-600'  },
            { label: 'Warteliste',   value: stats.waitlist, color: 'text-[var(--text-secondary)]'  },
            { label: 'No-Show',      value: stats.noShow,   color: 'text-red-600'    },
          ].map(k => (
            <div key={k.label} className="card p-3 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', k.color)}>{k.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Feiertag</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> Schulferien ({bundesland})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[var(--surface-panel)] border border-[var(--border)] inline-block" /> Wochenende</span>
        <span className="ml-auto text-[var(--text-muted)] italic">Termin ziehen zum Verschieben</span>
      </div>

      {/* MONATSANSICHT */}
      {view === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 bg-[var(--surface-panel)] border-b border-[var(--border)]">
            {DAY_LABELS.map(d => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: monthOffset }).map((_, i) => (
              <div key={'e' + i} className="min-h-[110px] border-b border-r border-[var(--border)] bg-[var(--surface-panel)]/30" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
              const d = new Date(current.getFullYear(), current.getMonth(), dayNum)
              const dateStr = fmtDate(d)
              const holidays = getHolidays(d)
              const isPublic = holidays.some(h => h.type === 'public')
              const isSchool = holidays.some(h => h.type === 'school')
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const isToday = sameDay(d, today)
              const isOver = dragOver === dateStr
              const dayAppts = apptForDay(d)

              return (
                <div key={dayNum}
                  className={cn(
                    'min-h-[110px] border-b border-r border-[var(--border)] p-1.5 transition-colors cursor-pointer',
                    isPublic ? 'bg-red-500/10' : isSchool ? 'bg-amber-500/10' : isWeekend ? 'bg-[var(--surface-panel)]/60' : '',
                    isOver ? 'bg-[var(--color-primary-light)] ring-2 ring-inset ring-[var(--color-primary)]/30' : 'hover:bg-[var(--surface-panel)]/80'
                  )}
                  onClick={() => router.push(newApptUrl(dateStr))}
                  onDragOver={e => { e.preventDefault(); setDragOver(dateStr) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); dropOnDate(dateStr) }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={cn(
                      'text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                      isToday ? 'text-white' : isPublic ? 'text-red-500' : isWeekend ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                    )} style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}>
                      {dayNum}
                    </span>
                    <div className="flex flex-col gap-0.5 items-end">
                      {holidays.filter(h => h.type === 'public').map((h, i) => (
                        <span key={i} className="text-[10px] px-1 rounded bg-red-100 text-red-700 font-medium truncate max-w-[80px]">{h.name}</span>
                      ))}
                      {isSchool && !isPublic && (
                        <span className="text-[10px] px-1 rounded bg-amber-50 text-amber-700 truncate max-w-[80px]">Ferien</span>
                      )}
                    </div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    {dayAppts.slice(0, 3).map(a => (
                      <div key={a.id}
                        draggable
                        onDragStart={() => setDragId(a.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null) }}
                        onClick={() => router.push(`/appointments/${a.id}/edit`)}
                        className={cn(
                          'rounded px-1.5 py-0.5 mb-0.5 text-xs truncate cursor-grab active:cursor-grabbing border',
                          dragId === a.id ? 'opacity-40' : ''
                        )}
                        style={{ backgroundColor: a.type.color + '20', borderColor: a.type.color + '60', color: a.type.color }}
                      >
                        {a.isBlocker ? (a.blockerNote || 'Blockiert') : a.patient ? a.patient.lastName : a.type.name}
                      </div>
                    ))}
                    {dayAppts.length > 3 && (
                      <span className="text-xs text-[var(--text-muted)] pl-1">+{dayAppts.length - 3}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* WOCHENANSICHT */}
      {view === 'week' && (
        <div className="card overflow-hidden">
          <div className="grid bg-[var(--surface-panel)] border-b border-[var(--border)]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div />
            {weekDays.map((d, i) => {
              const holidays = getHolidays(d)
              const isPublic = holidays.some(h => h.type === 'public')
              const isToday = sameDay(d, today)
              return (
                <div key={i} className={cn('p-2 text-center border-l border-[var(--border)]', isPublic && 'bg-red-50', isToday && 'bg-indigo-50/50')}>
                  <p className="text-xs text-[var(--text-muted)]">{DAY_LABELS[i]}</p>
                  <p className={cn('text-base font-bold', isToday ? 'text-white' : isPublic ? 'text-red-500' : 'text-[var(--text-primary)]')}
                    style={isToday ? { backgroundColor: 'var(--color-primary)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' } : {}}>
                    {d.getDate()}
                  </p>
                  {holidays.filter(h => h.type === 'public').map((h, j) => (
                    <p key={j} className="text-[10px] text-red-600 font-medium truncate">{h.name}</p>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
            {hours.map(h => (
              <div key={h} className="grid border-b border-[var(--border)]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: 52 }}>
                <div className="px-2 pt-1">
                  <span className="text-xs text-[var(--text-muted)]">{h}:00</span>
                </div>
                {weekDays.map((d, di) => {
                  const dateStr = fmtDate(d)
                  const isOver = dragOver === dateStr
                  const dayAppts = apptForDay(d).filter(a => new Date(a.startAt).getHours() === h)
                  return (
                    <div key={di}
                      className={cn(
                        'border-l border-[var(--border)] p-0.5',
                        sameDay(d, today) && 'bg-indigo-50/20',
                        isOver && 'bg-indigo-50 ring-1 ring-inset ring-indigo-300'
                      )}
                      onClick={() => router.push(newApptUrl(dateStr))}
                      onDragOver={e => { e.preventDefault(); setDragOver(dateStr) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => { e.preventDefault(); dropOnDate(dateStr) }}
                    >
                      {dayAppts.map(a => (
                        <div key={a.id}
                          draggable
                          onDragStart={() => setDragId(a.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null) }}
                          onClick={e => { e.stopPropagation(); router.push(`/appointments/${a.id}/edit`) }}
                          className={cn('rounded-lg border text-xs cursor-grab active:cursor-grabbing mb-0.5 px-2 py-1', dragId === a.id ? 'opacity-40' : '')}
                          style={{ backgroundColor: a.type.color + '20', borderColor: a.type.color + '60', color: a.type.color }}
                        >
                          <span className="font-semibold">{fmtTime(new Date(a.startAt))} </span>
                          {a.isBlocker ? (a.blockerNote || 'Blockiert') : a.patient ? a.patient.lastName : a.type.name}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRAXISÜBERSICHT */}
      {view === 'overview' && (
        <div className="card overflow-hidden">
          <div className="grid bg-[var(--surface-panel)] border-b border-[var(--border)]"
            style={{ gridTemplateColumns: `120px repeat(${therapists.length}, 1fr)` }}>
            <div className="p-3" />
            {therapists.map(t => (
              <div key={t.id} className="p-3 text-center border-l border-[var(--border)]">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mx-auto mb-1"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {(t.name ?? '').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">{t.name}</p>
              </div>
            ))}
          </div>
          {weekDays.map((d, di) => {
            const holidays = getHolidays(d)
            const isPublic = holidays.some(h => h.type === 'public')
            const isToday = sameDay(d, today)
            return (
              <div key={di}
                className={cn('grid border-b border-[var(--border)]', isPublic && 'bg-red-50/30')}
                style={{ gridTemplateColumns: `120px repeat(${therapists.length}, 1fr)` }}>
                <div className={cn('p-3', isToday && 'bg-indigo-50/50')}>
                  <p className="text-xs text-[var(--text-muted)]">{DAY_LABELS[di]}</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{d.getDate()}. {MONTH_LABELS[d.getMonth()].slice(0, 3)}</p>
                  {isPublic && <p className="text-[10px] text-red-600 font-medium">{holidays.find(h => h.type === 'public')?.name}</p>}
                </div>
                {therapists.map(t => {
                  const ta = appointments.filter(a => sameDay(new Date(a.startAt), d) && a.therapist?.name === t.name)
                  return (
                    <div key={t.id} className="p-1.5 border-l border-[var(--border)] min-h-12">
                      {ta.map(a => (
                        <div key={a.id}
                          draggable
                          onDragStart={() => setDragId(a.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null) }}
                          onClick={() => router.push(`/appointments/${a.id}/edit`)}
                          className="rounded px-1.5 py-0.5 mb-0.5 text-xs truncate border cursor-grab"
                          style={{ backgroundColor: a.type.color + '20', borderColor: a.type.color + '50', color: a.type.color }}>
                          {a.isBlocker ? 'Blockiert' : a.patient ? a.patient.lastName : a.type.name}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
