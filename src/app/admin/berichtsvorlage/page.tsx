import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { BerichtsvorlageClient } from './BerichtsvorlageClient'
import { DEFAULT_REPORT_HTML } from '@/lib/report/template'

export default async function BerichtsvorlagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const templates = await prisma.reportTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ reportType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  })

  return (
    <PageShell>
      <BerichtsvorlageClient
        templates={templates as any}
        defaultHtml={DEFAULT_REPORT_HTML}
      />
    </PageShell>
  )
}
