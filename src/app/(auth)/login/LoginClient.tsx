'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Mail, Lock, Hash, Activity, AlertCircle } from 'lucide-react'
import type { BrandingConfig } from '@/lib/branding'
import { LOGIN_POSITION_FLEX } from '@/lib/branding'

export function LoginClient({ branding }: { branding: BrandingConfig }) {
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
  const logoSize = branding.loginLogoSize ?? 64
  const cardBg = branding.loginCardBg ?? 'rgba(255,255,255,0.92)'
  const cardBlur = branding.loginCardBlur ?? 12
  const cardRadius = branding.loginCardRadius ?? 20
  const cardShadow = branding.loginCardShadow ?? true
  const offsetX = branding.loginBoxOffsetX ?? 0
  const offsetY = branding.loginBoxOffsetY ?? 0

  const hasBg = !!bgSrc
  const textOnBg = hasBg ? '#ffffff' : 'var(--text-primary)'
  const subTextOnBg = hasBg ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)'

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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px 11px 38px',
    fontSize: 14, border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 10, background: 'rgba(255,255,255,0.9)',
    color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: bgSrc ? 'transparent' : (branding.loginBgColor ?? 'var(--surface-page)'),
      backgroundColor: !bgSrc ? (branding.loginBgColor ?? 'var(--surface-page)') : undefined,
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

      {/* Login-Box mit Feinpositionierung */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: 400,
        transform: `translate(${offsetX}%, ${offsetY}%)`,
        transition: 'transform 0.2s',
      }}>
        {/* Logo + Praxisname */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" style={{
              width: logoSize, height: logoSize,
              objectFit: 'contain', margin: '0 auto 14px', display: 'block',
              filter: hasBg ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' : 'none',
            }} />
          ) : (
            <div style={{
              width: logoSize, height: logoSize,
              borderRadius: logoSize * 0.22, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', backgroundColor: 'var(--color-primary)',
              boxShadow: hasBg ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 12px rgba(79,70,229,0.3)',
            }}>
              <Activity style={{ width: logoSize * 0.5, height: logoSize * 0.5, color: 'white' }} />
            </div>
          )}
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
            color: textOnBg,
            textShadow: hasBg ? '0 1px 6px rgba(0,0,0,0.4)' : 'none',
            margin: 0, marginBottom: 5,
          }}>
            {branding.praxisName}
          </h1>
          {branding.slogan && (
            <p style={{
              fontSize: 13, color: subTextOnBg, margin: 0,
              textShadow: hasBg ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}>
              {branding.slogan}
            </p>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: cardBg,
          backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
          WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
          borderRadius: cardRadius,
          padding: '28px 28px 24px',
          boxShadow: cardShadow
            ? '0 8px 40px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.6) inset'
            : 'none',
          border: '1px solid rgba(255,255,255,0.5)',
        }}>
          {/* Tab-Wechsel */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.05)',
            borderRadius: 12, padding: 4, marginBottom: 24, gap: 4,
          }}>
            {([['email', Mail, 'E-Mail / Passwort'], ['pin', Hash, 'Patienten-PIN']] as const).map(([t, Icon, label]) => (
              <button key={t} onClick={() => { setTab(t as any); setError('') }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '8px 4px', borderRadius: 9, border: 'none',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.18s',
                  background: tab === t ? '#ffffff' : 'transparent',
                  color: tab === t ? 'var(--color-primary)' : '#64748b',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}>
                <Icon style={{ width: 14, height: 14 }} />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              padding: '10px 12px', borderRadius: 10, marginBottom: 16,
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca',
            }}>
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              {error}
            </div>
          )}

          {tab === 'email' ? (
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, letterSpacing: '0.02em' }}>
                  E-Mail-Adresse
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input type="email" style={inputStyle} placeholder="name@praxis.at"
                    value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, letterSpacing: '0.02em' }}>
                  Passwort
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input type={showPw ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 42 }} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none' }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                    {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{
                marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, var(--color-primary), var(--color-accent))`,
                color: 'white', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '0.01em', transition: 'opacity 0.15s, transform 0.1s',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 15px rgba(79,70,229,0.35)',
              }}>
                {loading ? 'Anmelden…' : 'Anmelden'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, letterSpacing: '0.02em' }}>
                  6-stelliger PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <Hash style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.3em', fontFamily: 'monospace', fontSize: 16 }}
                    placeholder="123456"
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required
                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none' }} />
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>
                  Ihr PIN wurde von Ihrer Therapeutin vergeben.
                </p>
              </div>
              <button type="submit" disabled={loading} style={{
                marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, var(--color-primary), var(--color-accent))`,
                color: 'white', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 15px rgba(79,70,229,0.35)',
              }}>
                {loading ? 'Anmelden…' : 'Mit PIN anmelden'}
              </button>
            </form>
          )}
        </div>

        <p style={{
          textAlign: 'center', fontSize: 11, marginTop: 20,
          color: hasBg ? 'rgba(255,255,255,0.5)' : '#94a3b8',
          textShadow: hasBg ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
        }}>
          KDS · Klinisches Dokumentationssystem · DSGVO-konform
        </p>
      </div>
    </div>
  )
}
