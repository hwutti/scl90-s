'use client'
import { useState, useEffect } from 'react'
import { Share2, X, Check, Trash2, AlertCircle } from 'lucide-react'

interface Therapist { id: string; name: string; email: string }
interface Share { id: string; sharedWithId: string; canEdit: boolean; sharedWith: Therapist }

export function PatientShareButton({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<Share[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch(`/api/patients/${patientId}/shares`).then(r => r.json()),
      fetch('/api/therapists').then(r => r.ok ? r.json() : []),
    ]).then(([s, t]) => {
      setShares(Array.isArray(s) ? s : [])
      setTherapists(Array.isArray(t) ? t : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open, patientId])

  async function addShare() {
    if (!selectedId) return
    setError('')
    const res = await fetch(`/api/patients/${patientId}/shares`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharedWithId: selectedId, canEdit }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler'); return }
    setShares(s => [...s.filter(x => x.sharedWithId !== selectedId), data])
    setSelectedId(''); setCanEdit(false)
  }

  async function removeShare(sharedWithId: string) {
    await fetch(`/api/patients/${patientId}/shares`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharedWithId }),
    })
    setShares(s => s.filter(x => x.sharedWithId !== sharedWithId))
  }

  const availableTherapists = therapists.filter(t => !shares.some(s => s.sharedWithId === t.id))

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary"
        style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Share2 style={{ width: 13, height: 13 }} /> Freigeben
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-card)', borderRadius: 14, padding: 24, width: 440,
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                <Share2 style={{ width: 16, height: 16, display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                Patient freigeben
              </h3>
              <button onClick={() => setOpen(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Standardmäßig sieht nur Ihr Kollege keine Patientendaten. Geben Sie diesen Patienten gezielt für Vertretung oder Co-Behandlung frei.
            </p>

            {error && (
              <div style={{ padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 12, color: 'var(--red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle style={{ width: 13, height: 13 }} />{error}
              </div>
            )}

            {/* Bestehende Freigaben */}
            {shares.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Freigegeben für
                </div>
                {shares.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-page)', borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                      {(s.sharedWith.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.sharedWith.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.canEdit ? 'Lesen & Bearbeiten' : 'Nur Lesen'}</div>
                    </div>
                    <button onClick={() => removeShare(s.sharedWithId)} className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Neue Freigabe */}
            {availableTherapists.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--surface-page)', borderRadius: 10 }}>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-card)', color: 'var(--text-primary)' }}>
                  <option value="">Therapeut auswählen...</option>
                  {availableTherapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={canEdit} onChange={e => setCanEdit(e.target.checked)} />
                  Bearbeiten erlauben (sonst nur Lesen)
                </label>
                <button onClick={addShare} disabled={!selectedId} className="btn-primary" style={{ fontSize: 13, justifyContent: 'center' }}>
                  <Check style={{ width: 13, height: 13 }} /> Freigeben
                </button>
              </div>
            ) : !loading && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                {therapists.length === 0 ? 'Keine weiteren Therapeuten im System.' : 'Bereits an alle Therapeuten freigegeben.'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
