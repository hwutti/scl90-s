
'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Calendar, FileText, Tag, ExternalLink, Trash2, Plus, X } from 'lucide-react'
import { INVOICE_PLACEHOLDERS } from '@/lib/invoice/template'

export function SettingsClient({ googleCal, invoiceTemplates, txTypes }: any) {
  const searchParams = useSearchParams()
  const googleStatus = searchParams?.get('google')
  const [tab, setTab] = useState('google')
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', htmlContent: '', isDefault: false })
  const [saving, setSaving] = useState(false)

  async function saveTemplate() {
    setSaving(true)
    await fetch('/api/invoice-templates', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(templateForm),
    })
    setSaving(false); setShowNewTemplate(false); window.location.reload()
  }

  async function disconnectGoogle() {
    if (!confirm('Google Calendar trennen?')) return
    await fetch('/api/google-calendar/disconnect', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div className="topbar">
        <h1 style={{fontSize:16,fontWeight:600,color:'var(--text-primary)',margin:0}}>Einstellungen</h1>
      </div>

      <div style={{padding:'12px 20px 0',background:'var(--surface-card)',borderBottom:'0.5px solid var(--border)'}}>
        <div style={{display:'flex',gap:0}}>
          {[['google','Google Calendar'],['templates','Rechnungsvorlagen'],['txTypes','Transaktionstypen']].map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)}
              style={{padding:'8px 16px',background:'none',border:'none',cursor:'pointer',fontSize:13,
                fontWeight:tab===key?600:400,
                color:tab===key?'var(--color-primary)':'var(--text-muted)',
                borderBottom:tab===key?'2px solid var(--color-primary)':'2px solid transparent'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:20,flex:1}}>

        {/* ── GOOGLE CALENDAR ── */}
        {tab === 'google' && (
          <div style={{maxWidth:600,display:'flex',flexDirection:'column',gap:14}}>
            {googleStatus === 'connected' && (
              <div style={{padding:'10px 14px',background:'var(--green-bg)',border:'0.5px solid var(--green-border)',borderRadius:8,color:'var(--green)',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                <CheckCircle style={{width:16,height:16}}/> Google Calendar erfolgreich verbunden!
              </div>
            )}
            {googleStatus === 'error' && (
              <div style={{padding:'10px 14px',background:'var(--red-bg)',border:'0.5px solid var(--red-border)',borderRadius:8,color:'var(--red)',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                <AlertCircle style={{width:16,height:16}}/> Verbindung fehlgeschlagen. Bitte erneut versuchen.
              </div>
            )}

            <div className="card" style={{padding:20}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:40,height:40,borderRadius:10,background:'var(--color-primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Calendar style={{width:18,height:18,stroke:'var(--color-primary)',fill:'none'}}/>
                </div>
                <div>
                  <h2 style={{margin:0,fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>Google Calendar</h2>
                  <p style={{margin:'2px 0 0',fontSize:12,color:'var(--text-muted)'}}>Termine synchronisieren und Buchungen blockieren</p>
                </div>
              </div>

              {googleCal ? (
                <div>
                  <div style={{padding:'10px 14px',background:'var(--green-bg)',border:'0.5px solid var(--green-border)',borderRadius:8,marginBottom:14}}>
                    <p style={{fontSize:13,color:'var(--green)',fontWeight:600,margin:'0 0 2px'}}>
                      <CheckCircle style={{width:13,height:13,display:'inline',verticalAlign:-2,marginRight:5}}/>
                      Verbunden als: {googleCal.email}
                    </p>
                    <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>Status: {googleCal.status}</p>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <a href="/api/google-calendar/connect" className="btn-secondary" style={{textDecoration:'none',fontSize:13}}>
                      <Calendar style={{width:13,height:13}}/> Erneut verbinden
                    </a>
                    <button onClick={disconnectGoogle} className="btn-danger" style={{fontSize:13}}>
                      <Trash2 style={{width:13,height:13}}/> Trennen
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{fontSize:13,color:'var(--text-secondary)',marginBottom:14,lineHeight:1.6}}>
                    Verbinde KDS mit Google Calendar um Termine zu synchronisieren. Patientendaten werden anonymisiert übertragen.
                  </p>
                  {!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED && (
                    <div style={{padding:'8px 12px',background:'var(--amber-bg)',border:'0.5px solid var(--amber-border)',borderRadius:8,marginBottom:12,fontSize:12,color:'var(--amber)'}}>
                      <strong>Hinweis:</strong> Bitte zuerst GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET in der .env konfigurieren.{' '}
                      <a href="/docs/google-calendar-setup.md" target="_blank" style={{color:'var(--color-primary)'}}>Anleitung ansehen</a>
                    </div>
                  )}
                  <a href="/api/google-calendar/connect" className="btn-primary" style={{textDecoration:'none',fontSize:13,display:'inline-flex',alignItems:'center',gap:6}}>
                    <Calendar style={{width:13,height:13}}/> Mit Google verbinden
                  </a>
                </div>
              )}
            </div>

            <div className="card" style={{padding:16}}>
              <h3 style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',margin:'0 0 10px'}}>Einrichtungsanleitung</h3>
              <ol style={{paddingLeft:20,fontSize:13,color:'var(--text-secondary)',lineHeight:1.8}}>
                <li>Google Cloud Console öffnen und Projekt erstellen</li>
                <li>Google Calendar API aktivieren</li>
                <li>OAuth 2.0 Client-ID erstellen (Webanwendung)</li>
                <li>Weiterleitungs-URI: <code style={{background:'var(--surface-panel)',padding:'1px 6px',borderRadius:4}}>https://DOMAIN/api/google-calendar/callback</code></li>
                <li>GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env eintragen</li>
                <li>Service neu starten und hier verbinden</li>
              </ol>
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
                className="btn-secondary" style={{marginTop:12,fontSize:12,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                <ExternalLink style={{width:12,height:12}}/> Google Cloud Console öffnen
              </a>
            </div>
          </div>
        )}

        {/* ── RECHNUNGSVORLAGEN ── */}
        {tab === 'templates' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <h2 style={{margin:0,fontSize:15,fontWeight:600,color:'var(--text-primary)'}}>Rechnungsvorlagen</h2>
              <button onClick={()=>setShowNewTemplate(true)} className="btn-primary">
                <Plus style={{width:13,height:13}}/> Neue Vorlage
              </button>
            </div>

            <div style={{marginBottom:14,padding:'10px 14px',background:'var(--surface-panel)',borderRadius:8,fontSize:13,color:'var(--text-secondary)'}}>
              Vorlagen verwenden <code style={{background:'var(--color-primary-light)',padding:'1px 6px',borderRadius:4,color:'var(--color-primary)'}}>{'{{platzhalter}}'}</code> Syntax.{' '}
              Verfügbare Platzhalter: {Object.keys(INVOICE_PLACEHOLDERS).slice(0,5).join(', ')}...
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {invoiceTemplates.map((t: any) => (
                <div key={t.id} className="card" style={{padding:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <FileText style={{width:16,height:16,stroke:'var(--color-primary)',fill:'none',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{t.name}</span>
                        {t.isDefault && <span className="badge badge-green">Standard</span>}
                      </div>
                      {t.description && <p style={{fontSize:12,color:'var(--text-muted)',margin:'2px 0 0'}}>{t.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRANSAKTIONSTYPEN ── */}
        {tab === 'txTypes' && (
          <div>
            <h2 style={{margin:'0 0 14px',fontSize:15,fontWeight:600,color:'var(--text-primary)'}}>Transaktionstypen</h2>
            <div className="card" style={{overflow:'hidden'}}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Richtung</th><th>BMD-Code</th><th>Typ</th></tr></thead>
                <tbody>
                  {txTypes.map((t: any) => (
                    <tr key={t.id}>
                      <td className="primary">{t.name}</td>
                      <td><span className={t.direction==='income'?'badge badge-green':'badge badge-red'}>{t.direction==='income'?'Einnahme':'Ausgabe'}</span></td>
                      <td style={{fontFamily:'monospace'}}>{t.bmdCode||'—'}</td>
                      <td><span className="badge badge-gray">{t.isSystemType?'System':'Eigener'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Template Modal */}
      {showNewTemplate && (
        <div className="modal-overlay" onClick={()=>setShowNewTemplate(false)}>
          <div className="modal" style={{maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{margin:0,fontSize:15}}>Neue Rechnungsvorlage</h2>
              <button onClick={()=>setShowNewTemplate(false)} className="btn-ghost" style={{padding:4}}><X style={{width:16,height:16}}/></button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label className="label">Name *</label>
                <input className="input" value={templateForm.name} onChange={e=>setTemplateForm(f=>({...f,name:e.target.value}))} placeholder="z.B. Honorarnote Standard"/>
              </div>
              <div><label className="label">Beschreibung</label>
                <input className="input" value={templateForm.description} onChange={e=>setTemplateForm(f=>({...f,description:e.target.value}))}/>
              </div>
              <div><label className="label">HTML-Template</label>
                <textarea className="input" rows={12} style={{fontFamily:'monospace',fontSize:12,resize:'vertical'}}
                  value={templateForm.htmlContent} onChange={e=>setTemplateForm(f=>({...f,htmlContent:e.target.value}))}
                  placeholder="<!DOCTYPE html><html>...verwende {{platzhalter}} Syntax..."/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="isDefault" checked={templateForm.isDefault}
                  onChange={e=>setTemplateForm(f=>({...f,isDefault:e.target.checked}))}/>
                <label htmlFor="isDefault" style={{fontSize:13,cursor:'pointer',color:'var(--text-primary)'}}>Als Standard-Vorlage setzen</label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowNewTemplate(false)} className="btn-secondary" style={{flex:1}}>Abbrechen</button>
              <button onClick={saveTemplate} disabled={saving||!templateForm.name||!templateForm.htmlContent} className="btn-primary" style={{flex:1,justifyContent:'center'}}>
                {saving?'Speichern...':'Vorlage speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
