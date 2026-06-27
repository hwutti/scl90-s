'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Calendar, LayoutGrid, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHolidayMap, BUNDESLAENDER } from '@/lib/holidays'
import type { Holiday } from '@/lib/holidays'

const DAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So']
const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

const STATUS_COLOR: Record<string,string> = {
  PENDING:   'border-amber-300 bg-amber-50 text-amber-800',
  CONFIRMED: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-400 line-through',
  NO_SHOW:   'border-red-300 bg-red-50 text-red-700',
  COMPLETED: 'border-blue-200 bg-blue-50 text-blue-700',
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatTime(d: Date) {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function startOfWeek(d: Date) {
  const c = new Date(d); const day = (c.getDay()+6)%7
  c.setDate(c.getDate()-day); c.setHours(0,0,0,0); return c
}

type ViewMode = 'week'|'month'|'overview'
interface Appt { id:string; startAt:string; endAt:string; status:string; type:{name:string;color:string}; patient?:{firstName:string;lastName:string}|null; therapist?:{name:string}|null; isBlocker:boolean; blockerNote?:string }

interface Props { currentUserId:string; role:string; types:any[]; therapists:any[]; patients:any[]; bundesland:string }


function HolidayBadge({ holidays }: { holidays: Holiday[] }) {
  const pub  = holidays.filter(h => h.type==='public')
  const sch  = holidays.filter(h => h.type==='school')
  return (
    <div className="flex flex-col gap-0.5">
      {pub.map((h,i) => <span key={i} className="text-[10px] px-1 rounded bg-red-100 text-red-700 font-medium truncate">{h.name}</span>)}
      {sch.length>0 && <span className="text-[10px] px-1 rounded bg-amber-50 text-amber-700 truncate">{sch[0].name}</span>}
    </div>
  )
}

function ApptBlock({ a, compact=false, onDragStart, onDragEnd, onClick }: {
  a: Appt; compact?: boolean
  onDragStart?: () => void; onDragEnd?: () => void; onClick?: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all hover:shadow-sm select-none',
        compact ? 'px-1.5 py-0.5 mb-0.5 truncate' : 'px-2 py-1 mb-0.5',
        dragAppt?.id === a.id && 'opacity-40'
      )}
      style={{ backgroundColor: a.type.color+'20', borderColor: a.type.color+'60', color: a.type.color }}
    >
      {!compact && <span className="font-semibold">{formatTime(new Date(a.startAt))} </span>}
      {a.isBlocker ? (a.blockerNote||'Blockiert') : a.patient ? `${a.patient.lastName}` : a.type.name}
    </div>
  )
}

function DayCell({ day, children, onClick, dragOver, onDragOver, onDragLeave, onDrop, holidayMap }: {
  day: Date; children?: React.ReactNode; onClick?: ()=>void
  dragOver?: string|null; onDragOver?: (dateStr:string)=>void
  onDragLeave?: ()=>void; onDrop?: (dateStr:string)=>void
  holidayMap?: Map<string, Holiday[]>
}) {
  const dateStr = fmt(day)
  const holidays = (holidayMap ?? new Map()).get(dateStr) ?? []
  const isPublic = holidays.some(h => h.type==='public')
  const isSchool = holidays.some(h => h.type==='school')
  const isToday  = isSameDay(day, new Date())
  const isOver   = dragOver === dateStr
  const isWeekend = day.getDay()===0 || day.getDay()===6

  return (
    <div
      className={cn(
        'relative min-h-[100px] border-b border-r border-slate-100 p-1.5 transition-colors',
        isPublic && 'bg-red-50/60',
        isSchool && !isPublic && 'bg-amber-50/40',
        isWeekend && !isPublic && !isSchool && 'bg-slate-50/60',
        isOver && 'bg-indigo-50 ring-2 ring-indigo-300 ring-inset',
        'cursor-pointer hover:bg-slate-50/80'
      )}
      onClick={onClick}
      onDragOver={e => { e.preventDefault(); onDragOver?.(dateStr) }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={e => { e.preventDefault(); onDrop?.(dateStr) }}
    >
      <div className="flex items-start justify-between mb-1">
        <span className={cn(
          'text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full',
          isToday ? 'text-white' : isPublic ? 'text-red-700' : isWeekend ? 'text-slate-400' : 'text-slate-700'
        )} style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}>
          {day.getDate()}
        </span>
        <HolidayBadge holidays={holidays} />
      </div>
      {children}
    </div>
  )
}

export function CalendarClient({ currentUserId, role, types, therapists, patients, bundesland }: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [appointments, setAppointments] = useState<Appt[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTherapist, setSelectedTherapist] = useState(currentUserId)
  const [stats, setStats] = useState<any>(null)
  const [dragAppt, setDragAppt] = useState<Appt|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)

  // Feiertage
  const year = current.getFullYear()
  const prevYear = year - 1
  const holidayMap = new Map([...getHolidayMap(prevYear, bundesland), ...getHolidayMap(year, bundesland), ...getHolidayMap(year+1, bundesland)])

  const getRange = useCallback(() => {
    if (view === 'week') {
      const from = startOfWeek(current)
      const to = new Date(from); to.setDate(from.getDate()+6); to.setHours(23,59,59)
      return { from, to }
    }
    const from = new Date(current.getFullYear(), current.getMonth(), 1)
    const to   = new Date(current.getFullYear(), current.getMonth()+1, 0, 23, 59, 59)
    return { from, to }
  }, [view, current])

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRange()
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
    if (selectedTherapist !== 'ALL') params.set('therapistId', selectedTherapist)
    const res = await fetch(`/api/appointments?${params}`)
    setAppointments(await res.json())
    setLoading(false)
  }, [getRange, selectedTherapist])

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/calendar/stats?therapistId=${selectedTherapist}`)
    setStats(await res.json())
  }, [selectedTherapist])

  useEffect(() => { load(); loadStats() }, [load, loadStats])

  function navigate(dir: number) {
    const d = new Date(current)
    if (view==='week') d.setDate(d.getDate()+dir*7)
    else d.setMonth(d.getMonth()+dir)
    setCurrent(d)
  }

  // Drag & Drop
  async function handleDrop(dateStr: string) {
    if (!dragAppt) return
    const orig = new Date(dragAppt.startAt)
    const [y,m,day] = dateStr.split('-').map(Number)
    const newStart = new Date(y, m-1, day, orig.getHours(), orig.getMinutes())
    setDragAppt(null); setDragOver(null)
    await fetch(`/api/appointments/${dragAppt.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: newStart.toISOString() }),
    })
    load()
  }

  // Wochen-Setup
  const weekStart = startOfWeek(current)
  const weekDays  = Array.from({ length:7 }, (_,i) => { const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return d })
  const hours     = Array.from({ length:12 }, (_,i) => i+7) // 7–18

  // Monats-Setup
  const monthStart     = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthDayOffset = (monthStart.getDay()+6)%7
  const daysInMonth    = new Date(current.getFullYear(), current.getMonth()+1, 0).getDate()

  function apptForDay(day: Date) {
    return appointments.filter(a => isSameDay(new Date(a.startAt), day))
      .sort((a,b) => new Date(a.startAt).getTime()-new Date(b.startAt).getTime())
  }

  const headerLabel = view==='week'
    ? `${weekDays[0].toLocaleDateString('de-AT',{day:'2-digit',month:'short'})} – ${weekDays[6].toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'})}`
    : `${MONTH_LABELS[current.getMonth()]} ${current.getFullYear()}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kalender</h1>
          <p className="text-slate-400 text-sm mt-0.5">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View-Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            {([['week','Woche'],['month','Monat'],['overview','Übersicht']] as [ViewMode,string][]).map(([v,l]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view===v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {v==='week' && <Calendar className="w-3.5 h-3.5" />}
                {v==='month' && <LayoutGrid className="w-3.5 h-3.5" />}
                {v==='overview' && <Users className="w-3.5 h-3.5" />}
                {l}
              </button>
            ))}
          </div>
          {/* Therapeuten-Filter */}
          {role==='ADMIN' && (
            <select className="input text-sm py-1.5" value={selectedTherapist}
              onChange={e => setSelectedTherapist(e.target.value)}>
              <option value="ALL">Alle Therapeuten</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrent(new Date())} className="btn-secondary px-3 py-2 text-xs font-medium">Heute</button>
            <button onClick={() => navigate(1)} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => router.push(`/appointments/new?date=${fmt(new Date())}&therapistId=${selectedTherapist!=='ALL'?selectedTherapist:currentUserId}`)}
            className="btn-primary">
            <Plus className="w-4 h-4" /> Termin
          </button>
        </div>
      </div>

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'Bevorstehend', value:stats.upcoming, color:'text-indigo-600' },
            { label:'Ausstehend',   value:stats.pending,  color:'text-amber-600' },
            { label:'Warteliste',   value:stats.waitlist, color:'text-slate-600' },
            { label:'No-Show',      value:stats.noShow,   color:'text-red-600' },
          ].map(k => (
            <div key={k.label} className="card p-3 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', k.color)}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Feiertag</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Schulferien ({bundesland})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Wochenende</span>
        <span className="ml-auto text-slate-400">Termin ziehen zum Verschieben</span>
      </div>

      {/* ── MONATSANSICHT ── */}
      {view==='month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {DAY_LABELS.map(d => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({length:monthDayOffset}).map((_,i) => (
              <div key={`e${i}`} className="min-h-[100px] border-b border-r border-slate-50 bg-slate-50/30" />
            ))}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(day => {
              const d = new Date(current.getFullYear(), current.getMonth(), day)
              const dayAppts = apptForDay(d)
              return (
                <DayCell key={day} day={d}
                  onClick={() => router.push(`/appointments/new?date=${fmt(d)}&therapistId=${selectedTherapist!=='ALL'?selectedTherapist:currentUserId}`)}
                  dragOver={dragOver}
                  onDragOver={setDragOver}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={handleDrop}
                  holidayMap={holidayMap}>
                  <div onClick={e => e.stopPropagation()}>
                    {dayAppts.slice(0,3).map(a => <ApptBlock key={a.id} a={a} compact onDragStart={() => setDragAppt(a)} onDragEnd={() => {setDragAppt(null);setDragOver(null)}} onClick={() => router.push(`/appointments/${a.id}/edit`)} />)}
                    {dayAppts.length>3 && <span className="text-xs text-slate-400 pl-1">+{dayAppts.length-3}</span>}
                  </div>
                </DayCell>
              )
            })}
          </div>
        </div>
      )}

      {/* ── WOCHENANSICHT ── */}
      {view==='week' && (
        <div className="card overflow-hidden">
          <div className="grid border-b border-slate-100 bg-slate-50" style={{gridTemplateColumns:'52px repeat(7,1fr)'}}>
            <div />
            {weekDays.map((d,i) => {
              const holidays = holidayMap.get(fmt(d)) ?? []
              const isPublic = holidays.some(h=>h.type==='public')
              const isToday  = isSameDay(d, new Date())
              return (
                <div key={i} className={cn('p-2 text-center border-l border-slate-100', isPublic&&'bg-red-50', isToday&&'bg-indigo-50/50')}>
                  <p className="text-xs text-slate-400">{DAY_LABELS[i]}</p>
                  <p className={cn('text-base font-bold', isToday?'text-white':'isPublic?text-red-700':'text-slate-700')}
                    style={isToday?{backgroundColor:'var(--color-primary)',borderRadius:'50%',width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}:{}}>
                    {d.getDate()}
                  </p>
                  {holidays.filter(h=>h.type==='public').map((h,j) => (
                    <p key={j} className="text-[10px] text-red-600 font-medium truncate">{h.name}</p>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="overflow-y-auto" style={{maxHeight:560}}>
            {hours.map(h => (
              <div key={h} className="grid border-b border-slate-50" style={{gridTemplateColumns:'52px repeat(7,1fr)',minHeight:52}}>
                <div className="px-2 pt-1"><span className="text-xs text-slate-300">{h}:00</span></div>
                {weekDays.map((d,di) => {
                  const dateStr = fmt(d)
                  const dayAppts = apptForDay(d).filter(a => new Date(a.startAt).getHours()===h)
                  const isOver = dragOver===dateStr
                  return (
                    <div key={di}
                      className={cn('border-l border-slate-50 p-0.5', isSameDay(d,new Date())&&'bg-indigo-50/20', isOver&&'bg-indigo-50 ring-1 ring-indigo-300 ring-inset')}
                      onClick={() => router.push(`/appointments/new?date=${dateStr}&therapistId=${selectedTherapist!=='ALL'?selectedTherapist:currentUserId}`)}
                      onDragOver={e => { e.preventDefault(); setDragOver(dateStr) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => { e.preventDefault()
                        const orig = new Date(dragAppt!.startAt)
                        const newStart = new Date(d.getFullYear(),d.getMonth(),d.getDate(),orig.getHours(),orig.getMinutes())
                        setDragAppt(null); setDragOver(null)
                        fetch(`/api/appointments/${dragAppt!.id}`, {
                          method:'PATCH', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ startAt: newStart.toISOString() })
                        }).then(() => load())
                      }}>
                      {dayAppts.map(a => (
                        <div key={a.id} onClick={e=>e.stopPropagation()}>
                          <ApptBlock a={a} />
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

      {/* ── PRAXISÜBERSICHT ── */}
      {view==='overview' && (
        <div className="card overflow-hidden">
          <div className="grid border-b border-slate-100 bg-slate-50" style={{gridTemplateColumns:`120px repeat(${therapists.length},1fr)`}}>
            <div className="p-3"/>
            {therapists.map(t => (
              <div key={t.id} className="p-3 text-center border-l border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mx-auto mb-1"
                  style={{backgroundColor:'var(--color-primary)'}}>
                  {t.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
                <p className="text-xs font-medium text-slate-700 truncate">{t.name}</p>
              </div>
            ))}
          </div>
          {weekDays.map((d,di) => {
            const holidays = holidayMap.get(fmt(d))??[]
            const isPublic = holidays.some(h=>h.type==='public')
            return (
              <div key={di} className={cn('grid border-b border-slate-50',isPublic&&'bg-red-50/30')} style={{gridTemplateColumns:`120px repeat(${therapists.length},1fr)`}}>
                <div className={cn('p-3',isSameDay(d,new Date())&&'bg-indigo-50/50')}>
                  <p className="text-xs text-slate-400">{DAY_LABELS[di]}</p>
                  <p className="text-sm font-semibold text-slate-700">{d.getDate()}. {MONTH_LABELS[d.getMonth()].slice(0,3)}</p>
                  {isPublic && <p className="text-[10px] text-red-600 font-medium">{holidays.find(h=>h.type==='public')?.name}</p>}
                </div>
                {therapists.map(t => {
                  const ta = appointments.filter(a => isSameDay(new Date(a.startAt),d) && a.therapist?.name===t.name)
                  return (
                    <div key={t.id} className="p-1.5 border-l border-slate-50 min-h-12">
                      {ta.map(a => <ApptBlock key={a.id} a={a} compact onDragStart={() => setDragAppt(a)} onDragEnd={() => {setDragAppt(null);setDragOver(null)}} onClick={() => router.push(`/appointments/${a.id}/edit`)} />)}
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
