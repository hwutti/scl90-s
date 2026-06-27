'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LayoutDashboard, Users, Settings, LogOut, Activity, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role ?? 'PATIENT'

  const navItems = role === 'PATIENT'
    ? [{ href: '/my', label: 'Meine Tests', icon: ClipboardList }]
    : [
        { href: '/patients', label: 'Patienten', icon: Users },
        { href: '/admin/users', label: 'Benutzer', icon: LayoutDashboard },
        ...(role === 'ADMIN' ? [{ href: '/admin/norm-tables', label: 'Normwerte', icon: Settings }] : []),
      ]

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link href={role === 'PATIENT' ? '/my' : '/patients'} className="flex items-center gap-2.5 font-bold text-indigo-600">
          <Activity className="w-5 h-5" />
          <span className="hidden sm:inline">SCL-90-S</span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(item.href)
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}>
              <item.icon className="w-4 h-4" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-slate-700 leading-tight">
                {session.user.name ?? session.user.email ?? 'Patient'}
              </p>
              <p className="text-xs text-slate-400">{role}</p>
            </div>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
