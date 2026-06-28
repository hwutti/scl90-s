'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Users, LogOut, Activity, Info, ChevronRight, User, Shield, CalendarDays, Bell, Sun, Moon, Euro, Video, ClipboardList, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/app/providers'
import type { BrandingConfig } from '@/lib/branding'

const NAV_ITEMS = [
  { href: '/patients', label: 'Patienten', icon: Users, roles: ['ADMIN','THERAPIST'] },
  { href: '/calendar', label: 'Kalender', icon: CalendarDays, roles: ['ADMIN','THERAPIST'],
    sub: [
      { href: '/calendar', label: 'Übersicht' },
      { href: '/calendar/stats', label: 'Auslastung' },
    ]
  },
  { href: '/my', label: 'Meine Tests', icon: Activity, roles: ['PATIENT'] },
  { href: '/finance', label: 'Finanzen', icon: Euro, roles: ['ADMIN','THERAPIST'] },
  { href: '/video-calls', label: 'Video-Calls', icon: Video, roles: ['ADMIN','THERAPIST'] },
  { href: '/supervision', label: 'Supervision', icon: GraduationCap, roles: ['ADMIN','THERAPIST'] },
  { href: '/my/appointments', label: 'Meine Termine', icon: CalendarDays, roles: ['PATIENT'] },
  { href: '/admin/users', label: 'Administration', icon: Shield, roles: ['ADMIN'],
    sub: [
      { href: '/admin/users', label: 'Benutzer' },
      { href: '/admin/appointment-types', label: 'Termintypen' },
      { href: '/admin/availability', label: 'Verfügbarkeit' },
      { href: '/admin/norm-tables', label: 'Normwerte' },
      { href: '/admin/branding', label: 'Branding & Praxis' },
    ]
  },
]

function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = React.useState(0)
  React.useEffect(() => {
    const load = () => fetch('/api/notifications').then(r => r.json()).then(d => setUnread(d.unread ?? 0)).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [userId])
  return (
    <Link href="/notifications" className="nav-link">
      <Bell style={{ width: 15, height: 15, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13 }}>Benachrichtigungen</span>
      {unread > 0 && (
        <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 10, fontWeight: 700,
          borderRadius: '10px', padding: '1px 6px', marginLeft: 'auto' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ branding }: { branding: BrandingConfig }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const role = (session?.user as any)?.role ?? 'PATIENT'
  const name = session?.user?.name ?? ''
  const userId = (session?.user as any)?.id ?? ''
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'THERAPIST' ? 'Therapeut/in' : 'Patient/in'
  const logoSrc = branding.logoBase64 ? `data:${branding.logoMimeType};base64,${branding.logoBase64}` : null
  const visibleNav = NAV_ITEMS.filter(i => i.roles.includes(role))

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, height: '100vh',
      width: 'var(--sidebar-width)',
      background: 'var(--sb-bg)',
      borderRight: '0.5px solid var(--sb-border)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      {/* Brand */}
      <div style={{ padding: '14px 12px', borderBottom: '0.5px solid var(--sb-border)' }}>
        <Link href={role === 'PATIENT' ? '/my' : '/patients'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {logoSrc
            ? <img src={logoSrc} alt="Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity style={{ width: 16, height: 16, stroke: '#fff', fill: 'none' }} />
              </div>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
              {branding.praxisName}
            </div>
            {branding.slogan && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                {branding.slogan}
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {visibleNav.map(item => {
          const isActive = pathname.startsWith(item.href)
          const subActive = item.sub?.some(s => pathname.startsWith(s.href))
          const isOpen = isActive || subActive
          return (
            <div key={item.href}>
              <Link href={item.href} className={cn('nav-link', isOpen && 'active')} style={{ marginBottom: 1 }}>
                <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
                {item.sub && (
                  <ChevronRight style={{ width: 13, height: 13, opacity: 0.4, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                )}
              </Link>
              {item.sub && isOpen && (
                <div style={{ paddingLeft: 24, marginBottom: 4 }}>
                  {item.sub.map(s => {
                    const sa = pathname === s.href || (s.href !== item.href && pathname.startsWith(s.href))
                    return (
                      <Link key={s.href} href={s.href} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 10px', borderRadius: 7,
                        fontSize: 12, fontWeight: sa ? 600 : 400,
                        color: sa ? 'var(--sb-active-text)' : 'var(--text-muted)',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: sa ? 'var(--sb-active-text)' : 'var(--border-strong)', flexShrink: 0 }} />
                        {s.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ margin: '8px 0 4px', padding: '0 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Einstellungen
        </div>
        <Link href="/profile" className={cn('nav-link', pathname.startsWith('/profile') && 'active')}>
          <User style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>Mein Profil</span>
        </Link>
        <Link href="/impressum" className={cn('nav-link', pathname.startsWith('/impressum') && 'active')}>
          <Info style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>Über / Impressum</span>
        </Link>
      </nav>

      {/* User Footer */}
      <div style={{ padding: '8px', borderTop: '0.5px solid var(--sb-border)' }}>
        <NotificationBell userId={userId} />

        {/* Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 2 }}>
          <Sun style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
          <button onClick={toggle} className="theme-toggle" aria-label="Theme umschalten" />
          <Moon style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-panel)', marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{roleLabel}</div>
          </div>
        </div>

        <button onClick={() => signOut({ callbackUrl: '/login' })} className="nav-link w-full"
          style={{ color: 'var(--text-muted)', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as any).style.color = 'var(--red)'; (e.currentTarget as any).style.background = 'var(--red-bg)' }}
          onMouseLeave={e => { (e.currentTarget as any).style.color = 'var(--text-muted)'; (e.currentTarget as any).style.background = '' }}>
          <LogOut style={{ width: 15, height: 15 }} />
          <span style={{ fontSize: 13 }}>Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
