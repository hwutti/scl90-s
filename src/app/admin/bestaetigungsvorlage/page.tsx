import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { BestaetigungsvorlageClient } from './BestaetigungsvorlageClient'
import { DEFAULT_CONFIRMATION_HTML } from '@/lib/confirmation/template'

export default async function BestaetigungsvorlagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const templates = await prisma.confirmationTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return (
    <PageShell>
      <BestaetigungsvorlageClient
        templates={templates as any}
        defaultHtml={DEFAULT_CONFIRMATION_HTML}
      />
    </PageShell>
  )
}
