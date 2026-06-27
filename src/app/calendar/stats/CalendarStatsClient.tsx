'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ausstehend', CONFIRMED: 'Bestätigt', CANCELLED: 'Abgesagt',
  NO_SHOW: 'No-Show', COMPLETED: 'Abgeschlossen',
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#10b981', CANCELLED: '#94a3b8',
  NO_SHOW: '#ef4444', COMPLETED: '#6366f1',
}

export function CalendarStatsClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/stats/full')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-Refresh alle 30 Sekunden
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (!data && loading) {
    return <div className="text-slate-400 text-sm p-8 text-center">Lade Statistiken…</div>
  }

  if (!data) return null

  const { byStatus, byType, byDay } = data
  const total = byStatus.reduce((s: number, b: any) => s + b._count, 0)
  const maxDay = Math.max(...byDay, 1)
  const maxType = Math.max(...byType.map((b: any) => b._count), 1)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auslastung & Statistiken</h1>
          <p className="text-slate-400 text-sm mt-0.5">{month} · {total} Termine gesamt</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Stand: {lastUpdated.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="btn-secondary p-2"
            title="Jetzt aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status-Übersicht */}
      <div className="grid grid-cols-5 gap-3">
        {byStatus.map((b: any) => (
          <div key={b.status} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: STATUS_COLORS[b.status] }}>{b._count}</p>
            <p className="text-xs text-slate-400 mt-0.5">{STATUS_LABELS[b.status] ?? b.status}</p>
          </div>
        ))}
      </div>

      {/* Auslastung nach Wochentag */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Termine nach Wochentag</h2>
        <div className="flex items-end gap-2 h-36">
          {byDay.map((count: number, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-slate-600">{count}</span>
              <div className="w-full rounded-t-lg transition-all"
                style={{ height: `${(count / maxDay) * 100}px`, minHeight: count > 0 ? '4px' : '0', backgroundColor: 'var(--color-primary)' }} />
              <span className="text-xs text-slate-400">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Termine nach Typ */}
      {byType.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Termine nach Typ</h2>
          <div className="space-y-3">
            {byType.sort((a: any, b: any) => b._count - a._count).map((b: any) => (
              <div key={b.typeId} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.type?.color ?? '#94a3b8' }} />
                <span className="text-sm text-slate-600 w-36 truncate">{b.type?.name ?? 'Unbekannt'}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${(b._count / maxType) * 100}%`, backgroundColor: b.type?.color ?? '#94a3b8' }} />
                </div>
                <span className="text-sm font-semibold text-slate-700 w-6 text-right">{b._count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
