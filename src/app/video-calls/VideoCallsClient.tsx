
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Video, Copy, Check, ExternalLink, Clock } from 'lucide-react'

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d))
}

const STATUS_CLASS: Record<string,string> = {
  PLANNED:'badge-blue', ACTIVE:'badge-green', ENDED:'badge-gray', EXPIRED:'badge-gray', CANCELLED:'badge-red',
}
const STATUS_LABEL: Record<string,string> = {
  PLANNED:'Geplant', ACTIVE:'Aktiv', ENDED:'Beendet', EXPIRED:'Abgelaufen', CANCELLED:'Abgesagt',
}

export function VideoCallsClient() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ startsAt: '', expiresAt: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/video-calls').then(r=>r.json())
    setCalls(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createCall() {
    setSaving(true)
    await fetch('/api/video-calls', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(form),
    })
    setSaving(false); setShowNew(false); load()
  }

  function copyLink(link: string, id: string) {
    navigator.clipboard.writeText(link)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div className="topbar">
        <div style={{flex:1}}>
          <h1 style={{fontSize:16,fontWeight:600,color:'var(--text-primary)',margin:0}}>Video-Calls</h1>
          <p style={{fontSize:12,color:'var(--text-muted)',marginTop:1}}>Jitsi-basierte Videotelefonie · datenschutzkonform</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus style={{width:14,height:14}}/> Neuer Video-Call
        </button>
      </div>

      <div style={{padding:20,flex:1}}>
        <div style={{marginBottom:14,padding:'10px 14px',background:'var(--color-primary-light)',borderRadius:8,fontSize:13,color:'var(--color-primary)'}}>
          <strong>Datenschutz:</strong> Video-Calls werden über Jitsi abgewickelt. Der Raumname ist anonym und kann keiner Person zugeordnet werden. Links sind zeitlich begrenzt.
        </div>

        {loading ? <div className="empty-state"><div className="spinner" style={{width:24,height:24}}/></div> :
        calls.length === 0 ? (
          <div className="card" style={{padding:24}}>
            <div className="empty-state">
              <Video className="empty-state-icon" style={{width:36,height:36}}/>
              <p className="empty-state-text">Noch keine Video-Calls erstellt.</p>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {calls.map(call => (
              <div key={call.id} className="card" style={{padding:16}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:'var(--color-primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Video style={{width:18,height:18,stroke:'var(--color-primary)',fill:'none'}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',fontFamily:'monospace'}}>Code: {call.callCode}</span>
                      <span className={'badge '+STATUS_CLASS[call.status]}>{STATUS_LABEL[call.status]}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                      {call.startsAt && <span><Clock style={{width:11,height:11,display:'inline',verticalAlign:-2,marginRight:3}}/>Start: {fmtDate(call.startsAt)}</span>}
                      {call.expiresAt && <span>Ablauf: {fmtDate(call.expiresAt)}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={() => copyLink(call.accessLink, call.id)} className="btn-secondary" style={{fontSize:12,padding:'4px 10px'}}>
                      {copied===call.id ? <Check style={{width:13,height:13}}/> : <Copy style={{width:13,height:13}}/>}
                      {copied===call.id ? 'Kopiert!' : 'Link kopieren'}
                    </button>
                    <a href={call.accessLink} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{textDecoration:'none',fontSize:12,padding:'5px 12px',display:'flex',alignItems:'center',gap:5}}>
                      <ExternalLink style={{width:13,height:13}}/> Beitreten
                    </a>
                  </div>
                </div>
                <div style={{marginTop:10,padding:'6px 10px',background:'var(--surface-panel)',borderRadius:6,fontSize:12,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:6,overflowX:'auto'}}>
                  <span style={{flexShrink:0}}>Link:</span>
                  <span style={{fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{call.accessLink}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={()=>setShowNew(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Neuer Video-Call</h2>
              <button onClick={()=>setShowNew(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{padding:'8px 12px',background:'var(--surface-panel)',borderRadius:8,fontSize:13,color:'var(--text-secondary)'}}>
                Ein anonymer Jitsi-Raum wird erstellt. Der Link kann an den Patienten/die Patientin weitergegeben werden.
              </div>
              <div className="form-grid-2">
                <div><label className="label">Startzeit (optional)</label>
                  <input type="datetime-local" className="input" value={form.startsAt} onChange={e=>setForm(f=>({...f,startsAt:e.target.value}))}/>
                </div>
                <div><label className="label">Ablauf (optional)</label>
                  <input type="datetime-local" className="input" value={form.expiresAt} onChange={e=>setForm(f=>({...f,expiresAt:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowNew(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={createCall} disabled={saving} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {saving?'Erstelle...':'Video-Call erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
