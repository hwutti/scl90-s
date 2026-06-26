'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, Hash } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'credentials' | 'pin'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      redirect: false,
      email:    mode === 'credentials' ? email : undefined,
      password: mode === 'credentials' ? password : undefined,
      pin:      mode === 'pin' ? pin : undefined,
    })

    setLoading(false)
    if (result?.error) {
      setError('Anmeldedaten ungültig. Bitte erneut versuchen.')
    } else if (result?.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">SCL-90-S</h1>
          <p className="text-slate-500 text-sm mt-1">Symptom-Checkliste 90 Standard</p>
        </div>

        <div className="card p-8">
          {/* Mode Toggle */}
          <div className="flex rounded-xl border border-slate-200 p-1 mb-6 bg-slate-50">
            {(['credentials', 'pin'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'credentials' ? 'Therapeut / Admin' : 'Patient (PIN)'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'credentials' ? (
              <>
                <div>
                  <label className="label">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-9"
                      placeholder="name@praxis.at"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Passwort</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input pl-9 pr-10"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="label">6-stellige PIN</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="input pl-9 tracking-[0.3em] text-center text-lg font-mono"
                    placeholder="000000"
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Die PIN erhalten Sie von Ihrem Therapeuten.</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : null}
              {loading ? 'Anmeldung…' : 'Anmelden'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          SCL-90-S nach Franke (2014) · Nur für autorisierte Fachkräfte
        </p>
      </div>
    </div>
  )
}
