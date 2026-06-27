'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Lock, Mail, Hash, Activity } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode]         = useState<'credentials' | 'pin'>('credentials')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin]           = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [branding, setBranding] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/branding')
      .then(r => r.json())
      .then(setBranding)
      .catch(() => {})
  }, [])

  const logoSrc = branding?.logoBase64
    ? `data:${branding.logoMimeType};base64,${branding.logoBase64}`
    : null

  const primary = branding?.colorPrimary ?? '#166534'
  const praxisName = branding?.praxisName ?? 'Klinisches Dokumentationssystem'
  const slogan = branding?.slogan ?? ''

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      redirect: false,
      email:    mode === 'credentials' ? email    : undefined,
      password: mode === 'credentials' ? password : undefined,
      pin:      mode === 'pin'         ? pin       : undefined,
    })

    setLoading(false)
    if (res?.ok) {
      window.location.href = '/dashboard'
    } else {
      setError('Ungültige Anmeldedaten. Bitte erneut versuchen.')
    }
  }

  const canSubmit = mode === 'credentials'
    ? email.length > 0 && password.length > 0
    : pin.length === 6

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo + Name */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'contain', margin: '0 auto 1rem' }} />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Activity style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
          )}
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{praxisName}</h1>
          {slogan && <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>{slogan}</p>}
        </div>

        {/* Login-Karte */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#334155', margin: '0 0 1rem' }}>Anmelden</h2>

          {/* Mode-Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '1.25rem' }}>
            {[
              { key: 'credentials', label: 'E-Mail / Passwort' },
              { key: 'pin',         label: 'Patienten-PIN' },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setMode(t.key as any); setError('') }}
                style={{
                  flex: 1, padding: '6px', fontSize: '12px', fontWeight: '500',
                  borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: mode === t.key ? 'white' : 'transparent',
                  color: mode === t.key ? primary : '#64748b',
                  boxShadow: mode === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'credentials' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                <input
                  type="email"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
                  style={{ width: '100%', padding: '10px 14px 10px 40px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Passwort"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
                  style={{ width: '100%', padding: '10px 40px 10px 40px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Hash style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="● ● ● ● ● ●"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 6 && handleSubmit()}
                style={{ width: '100%', padding: '10px 14px 10px 40px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '22px', textAlign: 'center', letterSpacing: '0.4em', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>
          )}

          {error && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            style={{
              width: '100%', marginTop: '16px', padding: '12px',
              background: (!canSubmit || loading) ? '#94a3b8' : primary,
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: '600', cursor: (!canSubmit || loading) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '1rem' }}>
          {praxisName} · Klinisches Dokumentationssystem
        </p>
      </div>
    </div>
  )
}
