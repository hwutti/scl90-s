'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'

type Theme = 'light' | 'dark'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    const saved = localStorage.getItem('kds-theme') as Theme | null
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const t = saved ?? sys
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])
  const toggle = () => setTheme(t => {
    const next = t === 'light' ? 'dark' : 'light'
    localStorage.setItem('kds-theme', next)
    document.documentElement.setAttribute('data-theme', next)
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
