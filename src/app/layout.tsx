import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Sidebar } from '@/components/layout/Sidebar'
import { getBranding, brandingToCssVars } from '@/lib/branding'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Klinische Diagnostik',
  description: 'Klinisches Dokumentationssystem für Psychotherapie',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding()
  const cssVars  = brandingToCssVars(branding)
  const session  = await getServerSession(authOptions)
  const isLoggedIn = !!session

  return (
    <html lang="de">
      <head>
        <style>{`:root { ${cssVars} }`}</style>
      </head>
      <body>
        <Providers>
          {isLoggedIn ? (
            <div className="flex min-h-screen">
              {/* Sidebar */}
              <Sidebar branding={branding} />

              {/* Main Content */}
              <main
                className="flex-1 min-h-screen bg-slate-100"
                style={{ marginLeft: 'var(--sidebar-width)' }}
              >
                <div className="max-w-6xl mx-auto px-6 py-8">
                  {children}
                </div>
              </main>
            </div>
          ) : (
            /* Login-Seite: kein Layout-Wrapper */
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
              {children}
            </div>
          )}
        </Providers>
      </body>
    </html>
  )
}
