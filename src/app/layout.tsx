import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { getBranding, brandingToCssVars } from '@/lib/branding'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding()
  return {
    title: b.praxisName ?? 'KDS – Klinisches Dokumentationssystem',
    description: 'Klinisches Dokumentationssystem für Psychotherapie',
    icons: { icon: '/favicon.svg' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding   = await getBranding()
  const cssVars    = brandingToCssVars(branding)
  const session    = await getServerSession(authOptions)
  const isLoggedIn = !!session

  return (
    <html lang="de">
      <head>
        <style>{`:root { ${cssVars} }`}</style>
      </head>
      <body>
        <Providers>
          {isLoggedIn ? (
            <div className="flex min-h-screen" style={{ background: 'var(--surface-page)' }}>
              <Suspense fallback={null}><Sidebar branding={branding} /></Suspense>
              <main
                className="flex-1 min-h-screen flex flex-col"
                style={{ marginLeft: 'var(--sidebar-width)' }}
              >
                {children}
              </main>
            </div>
          ) : (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-page)' }}>
              {children}
            </div>
          )}
        </Providers>
      </body>
    </html>
  )
}
