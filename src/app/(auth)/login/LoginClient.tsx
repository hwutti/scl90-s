'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Lock, Mail, Hash, Activity } from 'lucide-react'
import type { BrandingConfig } from '@/lib/branding'

export function LoginClient({ branding }: { branding: BrandingConfig }) {
  const [mode, setMode] = useState<'credentials' | 'pin'>('credentials')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin]           = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const logoSrc = branding.logoBase64
    ? `data:${branding.logoMimeType};base64,${branding.logoBase64}`
    : null

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      redirect: false,
      email:    mode === 'credentials' ? email    : undefined,
      password: mode === 'credentials' ? password : undefined,
      pin:      mode === 'pin'         ? pin       : undefined,
    })
    setLoading(false)
    if (res?.ok) window.location.href = '/dashboard'
    else setError(res?.error === 'CredentialsSignin' ? 'E-Mail/Passwort ungültig.' : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: branding.colorPrimary }}
            >
              <Activity className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-800">{branding.praxisName}</h1>
          {branding.slogan && <p className="text-sm text-slate-400 mt-1">{branding.slogan}</p>}
        </div>

        <div className="card p-6 shadow-lg">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Anmelden</h2>
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            {[
              { key: 'credentials', label: 'E-Mail / Passwort' },
              { key: 'pin',         label: 'Patienten-PIN' },
            ].map(t => (
              <button key={t.key} onClick={() => { setMode(t.key as any); setError('') }}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={mode === t.key ? {
                  backgroundColor: 'white',
                  color: branding.colorPrimary,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                } : { color: '#64748b' }}>
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'credentials' ? (
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" className="input pl-10" placeholder="E-Mail-Adresse"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} className="input pl-10 pr-10" placeholder="Passwort"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                <button onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" inputMode="numeric" maxLength={6}
                className="input pl-10 text-center text-2xl font-mono tracking-[0.5em]"
                placeholder="● ● ● ● ● ●"
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,6))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 6 && handleSubmit()} />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'credentials' ? !email || !password : pin.length !== 6)}
            className="w-full mt-4 py-2.5 rounded-xl text-white text-sm font-semibold
                       transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
            style={{ backgroundColor: branding.colorPrimary }}
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Anmelden…</>
              : 'Anmelden'}
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          {branding.praxisName} · Klinisches Dokumentationssystem
        </p>
      </div>
    </div>
  )
}
