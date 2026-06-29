'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'

type Theme = 'light' | 'dark'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // 1. Sofort aus localStorage laden (kein Flash)
    const saved = localStorage.getItem('kds-theme') as Theme | null
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const t = saved ?? sys
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)

    // 2. DB-Theme laden und mit localStorage synchronisieren
    fetch('/api/settings/visual')
      .then(r => r.json())
      .then(d => {
        if (d?.theme && d.theme !== t) {
          setTheme(d.theme)
          localStorage.setItem('kds-theme', d.theme)
          document.documentElement.setAttribute('data-theme', d.theme)
        }
      })
      .catch(() => {}) // Kein Fehler wenn nicht eingeloggt
  }, [])

  const toggle = () => setTheme(t => {
    const next = t === 'light' ? 'dark' : 'light'
    localStorage.setItem('kds-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    // Auch in DB speichern damit Einstellungen konsistent bleiben
    fetch('/api/settings/visual', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {})
    return next
  })
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  )
}
