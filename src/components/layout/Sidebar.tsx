'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Users, Settings, LogOut, Activity, Info,
  ChevronRight, User, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandingConfig } from '@/lib/branding'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/patients',        label: 'Patienten',         icon: Users,    roles: ['ADMIN','THERAPIST'] },
  { href: '/my',              label: 'Meine Tests',       icon: Activity, roles: ['PATIENT'] },
  { href: '/admin/users',     label: 'Benutzer',          icon: Shield,   roles: ['ADMIN','THERAPIST'] },
  { href: '/admin/branding',  label: 'Branding & Praxis', icon: Settings, roles: ['ADMIN'] },
  { href: '/admin/norm-tables', label: 'Normwerte',       icon: Settings, roles: ['ADMIN'] },
]

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/profile',   label: 'Mein Profil',   icon: User,  roles: ['ADMIN','THERAPIST','PATIENT'] },
  { href: '/impressum', label: 'Über / Impressum', icon: Info, roles: ['ADMIN','THERAPIST','PATIENT'] },
]

interface Props {
  branding: BrandingConfig
}

export function Sidebar({ branding }: Props) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role ?? 'PATIENT'
  const name = session?.user?.name ?? ''

  const visibleNav    = NAV_ITEMS.filter(i => i.roles.includes(role))
  const visibleBottom = BOTTOM_ITEMS.filter(i => i.roles.includes(role))

  const logoSrc = branding.logoBase64
    ? `data:${branding.logoMimeType};base64,${branding.logoBase64}`
    : null

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-slate-200 flex flex-col z-40 shadow-sm"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* ── Praxis-Branding ── */}
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href={role === 'PATIENT' ? '/my' : '/patients'} className="flex items-center gap-3 group">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-9 h-9 rounded-lg object-contain" />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: branding.colorPrimary }}
            >
              <Activity className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate leading-tight">
              {branding.praxisName}
            </p>
            {branding.slogan && (
              <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">
                {branding.slogan}
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* ── Hauptnavigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleNav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-link', active && 'active')}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* ── Trennlinie + untere Links ── */}
      <div className="px-3 py-2 border-t border-slate-100 space-y-0.5">
        {visibleBottom.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-link', active && 'active')}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* ── Benutzer-Info + Abmelden ── */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: branding.colorPrimary }}
          >
            {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
            <p className="text-xs text-slate-400">
              {role === 'ADMIN' ? 'Administrator'
              : role === 'THERAPIST' ? 'Therapeut/in'
              : 'Patient/in'}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="nav-link w-full text-slate-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
