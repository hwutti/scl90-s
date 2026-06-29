'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Mail, Lock, Shield, Calendar, BarChart2,
  Save, Check, AlertCircle, Eye, EyeOff, Edit2, X, Camera, Trash2,
} from 'lucide-react'

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:      { label: 'Administrator',  color: '#7c3aed', bg: '#ede9fe' },
  THERAPIST:  { label: 'Therapeut*in',   color: '#0369a1', bg: '#e0f2fe' },
  PATIENT:    { label: 'Patient*in',     color: '#065f46', bg: '#d1fae5' },
  SUPERVISOR: { label: 'Supervisor*in',  color: '#92400e', bg: '#fef3c7' },
}

export function ProfileClient({ user, patientCount = 0 }: { user: any; patientCount?: number }) {
  const router = useRouter()

  // Bearbeitungs-States
  const [editName,  setEditName]  = useState(false)
  const [editEmail, setEditEmail] = useState(false)
  const [editPw,    setEditPw]    = useState(false)

  const [name,     setName]     = useState(user.name  ?? '')
  const [email,    setEmail]    = useState(user.email ?? '')
  const [curPw,    setCurPw]    = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [newPw2,   setNewPw2]   = useState('')
  const [showPw,   setShowPw]   = useState(false)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarBase64 ? `data:${user.avatarMime ?? 'image/jpeg'};base64,${user.avatarBase64}` : null
  )
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  const role = ROLE_LABELS[user.role] ?? { label: user.role, color: '#666', bg: '#f3f4f6' }
  const memberSince = new Date(user.createdAt).toLocaleDateString('de-AT', { dateStyle: 'long' })

  function resetMessages() { setSuccess(''); setError('') }

  async function saveName() {
    if (!name.trim()) return
    setSaving(true); resetMessages()
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (res.ok) { setSuccess('Name gespeichert.'); setEditName(false); router.refresh() }
    else setError(data.error ?? 'Fehler')
    setSaving(false)
  }

  async function saveEmail() {
    if (!email.trim()) return
    setSaving(true); resetMessages()
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) { setSuccess('E-Mail gespeichert.'); setEditEmail(false); router.refresh() }
    else setError(data.error ?? 'Fehler')
    setSaving(false)
  }

  async function savePassword() {
    if (newPw !== newPw2) { setError('Passwörter stimmen nicht überein.'); return }
    if (newPw.length < 8) { setError('Mindestens 8 Zeichen.'); return }
    setSaving(true); resetMessages()
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    })
    const data = await res.json()
    if (res.ok) {
      setSuccess('Passwort geändert.')
      setEditPw(false); setCurPw(''); setNewPw(''); setNewPw2('')
    } else setError(data.error ?? 'Fehler')
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      alert('Nur JPG, PNG, WebP oder GIF erlaubt.'); return
    }
    // Komprimieren via Canvas
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      URL.revokeObjectURL(url)
      const size = 200
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      // Zentriert zuschneiden
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      setAvatarPreview(dataUrl)
      setSavingAvatar(true)
      await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarBase64: base64, avatarMime: 'image/jpeg' }),
      })
      setSavingAvatar(false)
      setSuccess('Profilbild gespeichert.')
      setTimeout(() => setSuccess(''), 3000)
    }
    img.src = url
  }

  async function removeAvatar() {
    setSavingAvatar(true)
    await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeAvatar: true }),
    })
    setAvatarPreview(null)
    setSavingAvatar(false)
  }

  const inp = {
    style: {
      padding: '8px 10px', fontSize: 13, borderRadius: 7,
      border: '0.5px solid var(--border)', background: 'var(--surface-page)',
      color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' as const,
    }
  }

  return (
    <div style={{ maxWidth: 640, padding: '28px 24px' }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
        Mein Profil
      </h1>

      {/* Status-Meldungen */}
      {success && (
        <div style={{ padding: '10px 14px', background: 'var(--green-bg)', borderRadius: 8, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Check style={{ width: 14, height: 14 }} />{success}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AlertCircle style={{ width: 14, height: 14 }} />{error}
        </div>
      )}

      {/* Avatar + Rolle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--border)',
          }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="Profilbild" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>
                  {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                </span>
            }
          </div>
          {/* Upload-Button */}
          <label style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: '2px solid var(--surface-card)',
          }} title="Profilbild ändern">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
              onChange={handleAvatarUpload} />
            {savingAvatar
              ? <div style={{ width: 10, height: 10, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <Camera style={{ width: 12, height: 12 }} />}
          </label>
          {/* Entfernen-Button */}
          {avatarPreview && (
            <button onClick={removeAvatar} style={{
              position: 'absolute', top: 0, right: -4,
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--red)', color: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }} title="Profilbild entfernen">
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{user.name ?? '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{user.email ?? '—'}</div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: role.color, background: role.bg }}>
            {role.label}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <Calendar style={{ width: 12, height: 12 }} /> Mitglied seit
          </div>
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2 }}>{memberSince}</div>
        </div>
      </div>

      {/* Statistiken */}
      {user.role !== 'PATIENT' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Patienten', value: patientCount, icon: User },
            { label: 'Sitzungen', value: user._count?.therapySessions ?? 0, icon: Calendar },
            { label: 'Assessments', value: user._count?.createdAssessments ?? 0, icon: BarChart2 },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 14px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ padding: '12px 14px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: user.active ? 'var(--green)' : 'var(--red)' }}>
              {user.active ? '✓' : '✗'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Status</div>
          </div>
        </div>
      )}

      {/* Name bearbeiten */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
          <User style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Name</div>
            {editName ? (
              <input {...inp} value={name} onChange={e => setName(e.target.value)} autoFocus />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{user.name ?? '—'}</div>
            )}
          </div>
          {editName ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setEditName(false); setName(user.name ?? '') }} className="btn-ghost" style={{ padding: '5px 8px' }}><X style={{ width: 13, height: 13 }} /></button>
              <button onClick={saveName} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                <Save style={{ width: 12, height: 12 }} /> Speichern
              </button>
            </div>
          ) : (
            <button onClick={() => setEditName(true)} className="btn-ghost" style={{ padding: '5px 8px' }}>
              <Edit2 style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* E-Mail bearbeiten */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
          <Mail style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>E-Mail-Adresse</div>
            {editEmail ? (
              <input {...inp} type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{user.email ?? '—'}</div>
            )}
          </div>
          {editEmail ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setEditEmail(false); setEmail(user.email ?? '') }} className="btn-ghost" style={{ padding: '5px 8px' }}><X style={{ width: 13, height: 13 }} /></button>
              <button onClick={saveEmail} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                <Save style={{ width: 12, height: 12 }} /> Speichern
              </button>
            </div>
          ) : (
            <button onClick={() => setEditEmail(true)} className="btn-ghost" style={{ padding: '5px 8px' }}>
              <Edit2 style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* Rolle (nur anzeigen) */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
          <Shield style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Rolle</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{role.label}</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nur Admin kann ändern</span>
        </div>
      </div>

      {/* Passwort ändern */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
          <Lock style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Passwort</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>••••••••</div>
          </div>
          <button onClick={() => { setEditPw(p => !p); resetMessages() }} className={editPw ? 'btn-secondary' : 'btn-ghost'} style={{ padding: '5px 10px', fontSize: 12 }}>
            {editPw ? 'Abbrechen' : <><Edit2 style={{ width: 13, height: 13 }} /> Ändern</>}
          </button>
        </div>

        {editPw && (
          <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ paddingTop: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aktuelles Passwort</label>
              <div style={{ position: 'relative' }}>
                <input {...inp} type={showPw ? 'text' : 'password'} value={curPw} onChange={e => setCurPw(e.target.value)}
                  style={{ ...inp.style, paddingRight: 36 }} placeholder="Aktuelles Passwort" autoComplete="current-password" />
                <button onClick={() => setShowPw(s => !s)} type="button"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Neues Passwort</label>
              <input {...inp} type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Mindestens 8 Zeichen" autoComplete="new-password" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Neues Passwort wiederholen</label>
              <input {...inp} type={showPw ? 'text' : 'password'} value={newPw2} onChange={e => setNewPw2(e.target.value)}
                placeholder="Passwort bestätigen" autoComplete="new-password" />
              {newPw && newPw2 && newPw !== newPw2 && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Passwörter stimmen nicht überein</div>
              )}
              {newPw.length > 0 && newPw.length < 8 && (
                <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>Mindestens 8 Zeichen erforderlich</div>
              )}
            </div>
            <button onClick={savePassword} disabled={saving || !curPw || !newPw || newPw !== newPw2}
              className="btn-primary" style={{ fontSize: 13, alignSelf: 'flex-start' }}>
              <Save style={{ width: 13, height: 13 }} /> Passwort speichern
            </button>
          </div>
        )}
      </div>

      {/* Sicherheitshinweis */}
      <div style={{ padding: '12px 16px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        🔒 <strong>Sicherheit:</strong> Verwende ein starkes Passwort mit mindestens 8 Zeichen, Groß- und Kleinbuchstaben sowie Zahlen.
        Bei Verdacht auf unbefugten Zugriff wende dich an den Administrator.
      </div>

    </div>
  )
}
