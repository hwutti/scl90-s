'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Upload, Play, Pause, Trash2, Download, Edit2, Check, X, Square } from 'lucide-react'

interface AudioEntry {
  id: string; label: string; fileName: string; mimeType: string
  size: number; durationSec: number | null; source: string; createdAt: string
}

interface Props {
  sessionId?: string
  patientId?: string
  readOnly?: boolean
}

function fmtDur(sec: number | null | undefined): string {
  if (!sec) return '–'
  const m = Math.floor(sec / 60); const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s))
}

export function AudioRecorderPanel({ sessionId, patientId, readOnly }: Props) {
  const [recordings, setRecordings] = useState<AudioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const query = sessionId ? `sessionId=${sessionId}` : `patientId=${patientId}`

  const loadRecordings = useCallback(() => {
    fetch(`/api/audio?${query}`)
      .then(r => r.json()).then(setRecordings).catch(() => {}).finally(() => setLoading(false))
  }, [query])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  async function uploadBlob(blob: Blob, fileName: string, durationSec: number | null, source: string) {
    setUploading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', blob, fileName)
      form.append('label', fileName)
      form.append('source', source)
      if (durationSec) form.append('durationSec', String(durationSec))
      const res = await fetch(`/api/audio?${query}`, { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Upload fehlgeschlagen.'); return }
      loadRecordings()
    } catch (e: any) { setError(e.message ?? 'Fehler') }
    finally { setUploading(false) }
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const dur = recSeconds
        setRecSeconds(0)
        const name = `Aufnahme_${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}.webm`
        await uploadBlob(blob, name, dur, 'BROWSER_RECORDING')
      }
      mr.start(1000) // Chunks jede Sekunde
      mediaRef.current = mr
      setRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch (e: any) {
      setError('Mikrofon-Zugriff verweigert oder nicht verfügbar.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stop()
    setRecording(false)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    uploadBlob(file, file.name, null, 'UPLOAD')
  }

  function playAudio(id: string, mimeType: string) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if (playingId === id) { setPlayingId(null); return }
    const audio = new Audio(`/api/audio/${id}`)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => { setError('Wiedergabe fehlgeschlagen.'); setPlayingId(null) }
    audio.play().catch(() => setError('Wiedergabe fehlgeschlagen.'))
    audioRef.current = audio
    setPlayingId(id)
  }

  async function deleteRecording(id: string) {
    if (!confirm('Aufnahme unwiderruflich löschen?')) return
    await fetch(`/api/audio/${id}`, { method: 'DELETE' })
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null) }
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  async function saveLabel(id: string) {
    if (!editLabel.trim()) return
    await fetch(`/api/audio/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: editLabel }) })
    setRecordings(prev => prev.map(r => r.id === id ? { ...r, label: editLabel } : r))
    setEditingId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Browser-Aufnahme */}
          {recording ? (
            <button onClick={stopRecording} className="btn-primary"
              style={{ fontSize: 13, background: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Square style={{ width: 13, height: 13 }} />
              Stopp ({fmtDur(recSeconds)})
            </button>
          ) : (
            <button onClick={startRecording} disabled={uploading} className="btn-secondary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mic style={{ width: 13, height: 13 }} />
              Aufnahme starten
            </button>
          )}

          {/* Datei hochladen */}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || recording}
            className="btn-ghost" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload style={{ width: 13, height: 13 }} />
            {uploading ? 'Lädt hoch…' : 'Datei hochladen'}
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} />

          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--red)' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--red)',
                animation: 'pulse 1s infinite', display: 'inline-block',
              }} />
              Aufnahme läuft…
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Aufnahmeliste */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lädt…</div>
      ) : recordings.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
          Noch keine Aufnahmen vorhanden.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recordings.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: 'var(--surface-2)', borderRadius: 8,
              border: playingId === r.id ? '1px solid var(--color-primary)' : '0.5px solid var(--border)',
            }}>
              {/* Play/Pause */}
              <button onClick={() => playAudio(r.id, r.mimeType)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-primary)', flexShrink: 0 }}>
                {playingId === r.id
                  ? <Pause style={{ width: 18, height: 18 }} />
                  : <Play style={{ width: 18, height: 18 }} />}
              </button>

              {/* Label + Meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === r.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(r.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus style={{ fontSize: 13, padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)', flex: 1 }} />
                    <button onClick={() => saveLabel(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)' }}><Check style={{ width: 14, height: 14 }} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X style={{ width: 14, height: 14 }} /></button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {fmtDur(r.durationSec)} · {fmtSize(r.size)} · {fmtDate(r.createdAt)}
                  {r.source === 'BROWSER_RECORDING' ? ' · 🎙️' : ' · 📎'}
                </div>
              </div>

              {/* Aktionen */}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditingId(r.id); setEditLabel(r.label) }}
                    title="Umbenennen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                    <Edit2 style={{ width: 14, height: 14 }} />
                  </button>
                  <a href={`/api/audio/${r.id}`} download={r.fileName} title="Herunterladen"
                    style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: 4 }}>
                    <Download style={{ width: 14, height: 14 }} />
                  </a>
                  <button onClick={() => deleteRecording(r.id)} title="Löschen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}
