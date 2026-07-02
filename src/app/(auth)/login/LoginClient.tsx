'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Hash, Activity, AlertCircle } from 'lucide-react'
import type { BrandingConfig } from '@/lib/branding'
import { LOGIN_POSITION_FLEX } from '@/lib/branding'

export function LoginClient({ branding }: { branding: BrandingConfig }) {
  const router = useRouter()
  const [tab, setTab] = useState<'email' | 'pin'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const logoSrc = branding.logoBase64
    ? `data:${branding.logoMimeType};base64,${branding.logoBase64}`
    : null

  const bgSrc = branding.loginBgImageBase64
    ? `data:${branding.loginBgImageMime};base64,${branding.loginBgImageBase64}`
    : null

  const pos = LOGIN_POSITION_FLEX[branding.loginBoxPosition] ?? LOGIN_POSITION_FLEX['center']

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) { window.location.href = '/dashboard' }
    else setError('E-Mail oder Passwort ungültig.')
  }

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { pin, redirect: false })
    setLoading(false)
    if (res?.ok) { window.location.href = '/my' }
    else setError('PIN ungültig oder nicht gefunden.')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: bgSrc ? 'transparent' : (branding.loginBgColor ?? 'var(--surface-page)'),
      display: 'flex',
      alignItems: pos.align,
      justifyContent: pos.justify,
      padding: 40,
    }}>
      {/* Hintergrundbild */}
      {bgSrc && (
        <>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(${bgSrc})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
          {branding.loginBgOverlay > 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `rgba(0,0,0,${branding.loginBgOverlay})`,
            }} />
          )}
        </>
      )}

      {/* Login-Box */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', margin: '0 auto 12px' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', backgroundColor: 'var(--color-primary)' }}>
              <Activity style={{ width: 24, height: 24, color: 'white' }} />
            </div>
          )}
          <h1 style={{ fontSize: 18, fontWeight: 600, color: bgSrc ? '#fff' : 'var(--text-primary)', textShadow: bgSrc ? '0 1px 4px rgba(0,0,0,0.4)' : 'none' }}>
            {branding.praxisName}
          </h1>
          {branding.slogan && (
            <p style={{ fontSize: 13, marginTop: 4, color: bgSrc ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', textShadow: bgSrc ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}>
              {branding.slogan}
            </p>
          )}
        </div>

        <div className="card p-6" style={{ backdropFilter: bgSrc ? 'blur(12px)' : 'none', background: bgSrc ? 'rgba(255,255,255,0.92)' : 'var(--surface-card)' }}>
          <div className="tab-bar mb-5">
            <button onClick={() => { setTab("email"); setError("") }}
              className={"tab-item flex-1 justify-center " + (tab === "email" ? "active" : "")}>
              <Mail className="w-3.5 h-3.5" />
              E-Mail / Passwort
            </button>
            <button onClick={() => { setTab("pin"); setError("") }}
              className={"tab-item flex-1 justify-center " + (tab === "pin" ? "active" : "")}>
              <Hash className="w-3.5 h-3.5" />
              Patienten-PIN
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg mb-4"
              style={{ background: "var(--red-bg)", color: "var(--red)", border: "0.5px solid var(--red-border)" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {tab === "email" ? (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="label">E-Mail-Adresse</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <input type="email" className="input pl-9" placeholder="name@praxis.at"
                    value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="label">Passwort</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <input type={showPw ? "text" : "password"} className="input pl-9 pr-9" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2 py-2">
                {loading ? "Anmelden..." : "Anmelden"}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinLogin} className="space-y-3">
              <div>
                <label className="label">6-stelliger PIN</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    className="input pl-9 tracking-widest font-mono text-base" placeholder="123456"
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} required />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Ihr PIN wurde von Ihrer Therapeutin vergeben.
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2 py-2">
                {loading ? "Anmelden..." : "Mit PIN anmelden"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 20, color: bgSrc ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textShadow: bgSrc ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>
          KDS · Klinisches Dokumentationssystem · DSGVO-konform
        </p>
      </div>
    </div>
  )
}
