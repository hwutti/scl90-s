import { getBranding } from '@/lib/branding'
import { PageShell } from '@/components/layout/PageShell'

export default async function ImpressumPage() {
  const branding = await getBranding()
  return (
    <PageShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Über diese App</h1>
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-[var(--text-secondary)] mb-1">{branding.praxisName}</h2>
            {branding.slogan && <p className="text-[var(--text-muted)] text-sm">{branding.slogan}</p>}
          </div>
          {(branding.address || branding.contactEmail || branding.contactPhone) && (
            <div className="border-t border-[var(--border)] pt-4 space-y-1 text-sm text-[var(--text-secondary)]">
              {branding.address      && <p>{branding.address}</p>}
              {branding.contactPhone && <p>Tel: {branding.contactPhone}</p>}
              {branding.contactEmail && <p>E-Mail: <a href={`mailto:${branding.contactEmail}`} className="underline">{branding.contactEmail}</a></p>}
            </div>
          )}
          {branding.imprintHtml && (
            <div
              className="border-t border-[var(--border)] pt-4 text-sm text-[var(--text-secondary)] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: branding.imprintHtml }}
            />
          )}
          <div className="border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
            <p>Klinisches Dokumentationssystem · SCL-90-S nach Franke (2014)</p>
            <p className="mt-1">Aufbewahrungspflicht gemäß §16a Psychotherapiegesetz AT: 10 Jahre</p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
