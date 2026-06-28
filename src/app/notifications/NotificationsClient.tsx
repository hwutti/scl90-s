'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NotificationsClient({ notifications }: { notifications: any[] }) {
  const router = useRouter()
  const [items, setItems] = useState(notifications)

  async function markAllRead() {
    const unread = items.filter(n => !n.readAt).map(n => n.id)
    if (!unread.length) return
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: unread }),
    })
    setItems(i => i.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    router.refresh()
  }

  const unreadCount = items.filter(n => !n.readAt).length

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Benachrichtigungen</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{unreadCount} ungelesen</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <CheckCheck className="w-4 h-4" /> Alle als gelesen
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Keine Benachrichtigungen</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-slate-50">
          {items.map(n => (
            <div key={n.id} className={cn('flex gap-3 px-5 py-4', !n.readAt && 'bg-[var(--color-primary-light)]/40')}>
              <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', n.readAt ? 'bg-slate-200' : 'bg-[var(--color-primary-light)]0')} />
              <div className="flex-1 min-w-0">
                {n.subject && <p className="font-medium text-[var(--text-primary)] text-sm">{n.subject}</p>}
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{n.body}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {new Date(n.createdAt).toLocaleDateString('de-AT', { dateStyle: 'medium' })} · {new Date(n.createdAt).toLocaleTimeString('de-AT', { timeStyle: 'short' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
