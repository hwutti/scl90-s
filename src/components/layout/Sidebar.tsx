'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Users, LogOut, Activity, Info, ChevronRight, User,
  Shield, CalendarDays, Bell, BarChart3, Settings, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandingConfig } from '@/lib/branding'

interface NavSubItem { href: string; label: string }
interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
  sub?: NavSubItem[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/patients',
    label: 'Patienten',
    icon: Users,
    roles: ['ADMIN', 'THERAPIST'],
  },
  {
    href: '/calendar',
    label: 'Kalender',
    icon: CalendarDays,
    roles: ['ADMIN', 'THERAPIST'],
    sub: [
      { href: '/calendar',       label: 'Übersicht' },
      { href: '/calendar/stats', label: 'Auslastung' },
    ],
  },
  { href: '/my',               label: 'Meine Tests',   icon: Activity,   roles: ['PATIENT'] },
  { href: '/my/appointments',  label: 'Meine Termine', icon: CalendarDays, roles: ['PATIENT'] },
  {
    href: '/admin/users',
    label: 'Administration',
    icon: Shield,
    roles: ['ADMIN'],
    sub: [
      { href: '/admin/users',             label: 'Benutzer' },
      { href: '/admin/appointment-types', label: 'Termintypen' },
      { href: '/admin/availability',      label: 'Verfügbarkeit' },
      { href: '/admin/norm-tables',       label: 'Normwerte' },
      { href: '/admin/branding',          label: 'Branding & Praxis' },
    ],
  },
]

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/profile',   label: 'Mein Profil',      icon: User,     roles: ['ADMIN', 'THERAPIST', 'PATIENT'] },
  { href: '/impressum', label: 'Über / Impressum',  icon: Info,     roles: ['ADMIN', 'THERAPIST', 'PATIENT'] },
]

function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = React.useState(0)
  React.useEffect(() => {
    const load = () => fetch('/api/notifications').then(r => r.json()).then(d => setUnread(d.unread ?? 0))
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [userId])
  return (
    <Link href="/notifications" className="nav-link relative">
      <Bell className="w-4 h-4 shrink-0" />
      <span>Benachrichtigungen</span>
      {unread > 0 && (
        <span className="ml-auto text-xs font-semibold text-white rounded-full w-4 h-4 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-primary)', fontSize: 10 }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ branding }: { branding: BrandingConfig }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role ?? 'PATIENT'
  const name = session?.user?.name ?? ''
  const userId = (session?.user as any)?.id ?? ''

  const visibleNav    = NAV_ITEMS.filter(i => i.roles.includes(role))
  const visibleBottom = BOTTOM_ITEMS.filter(i => i.roles.includes(role))

  const logoSrc = branding.logoBase64
    ? `data:${branding.logoMimeType};base64,${branding.logoBase64}`
    : null

  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'THERAPIST' ? 'Therapeut/in' : 'Patient/in'

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--surface-2)',
        borderRight: '0.5px solid var(--border)',
      }}
    >
      {/* ── Praxis-Branding ── */}
      <div className="px-4 py-4" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <Link
          href={role === 'PATIENT' ? '/my' : '/patients'}
          className="flex items-center gap-3 group"
        >
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Activity className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
              {branding.praxisName}
            </p>
            {branding.slogan && (
              <p className="text-xs truncate leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {branding.slogan}
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visibleNav.map(item => {
          const isActive = pathname.startsWith(item.href)
          const subActive = item.sub?.some(s => pathname.startsWith(s.href))
          const isOpen = isActive || subActive

          if (item.sub) {
            return (
              <div key={item.href}>
                <Link href={item.href} className={cn('nav-link', isOpen && 'active')}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-sm">{item.label}</span>
                  <ChevronRight className={cn('w-3.5 h-3.5 opacity-40 transition-transform duration-200', isOpen && 'rotate-90')} />
                </Link>
                {isOpen && (
                  <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                    {item.sub.map(s => {
                      const subIsActive = pathname === s.href || (s.href !== item.href && pathname.startsWith(s.href))
                      return (
                        <Link
                          key={s.href}
                          href={s.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-150',
                            subIsActive
                              ? 'font-semibold'
                              : 'hover:bg-slate-50'
                          )}
                          style={{
                            color: subIsActive ? 'var(--color-primary)' : 'var(--text-muted)',
                          }}
                        >
                          <span className={cn('w-1 h-1 rounded-full shrink-0', subIsActive ? 'opacity-100' : 'opacity-0')}
                            style={{ background: 'var(--color-primary)' }} />
                          {s.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-link', isActive && 'active')}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom Links ── */}
      <div className="px-2 py-2 space-y-0.5" style={{ borderTop: '0.5px solid var(--border)' }}>
        {visibleBottom.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn('nav-link', pathname.startsWith(item.href) && 'active')}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ── User Footer ── */}
      <div className="px-3 py-3" style={{ borderTop: '0.5px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{roleLabel}</p>
          </div>
        </div>

        <NotificationBell userId={userId} />

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="nav-link w-full mt-0.5"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
            ;(e.currentTarget as HTMLElement).style.background = '#fef2f2'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
            ;(e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
