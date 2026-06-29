import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { RechnungsvorlageClient } from './RechnungsvorlageClient'
import { DEFAULT_INVOICE_HTML } from '@/lib/invoice/template'

export default async function RechnungsvorlagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role !== 'ADMIN') redirect('/dashboard')

  const templates = await prisma.invoiceTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  // Letzte Transaktion für Vorschau
  const lastTransaction = await prisma.transaction.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, referenceNumber: true, transactionDate: true, payerName: true, amountGross: true },
  })

  return (
    <PageShell>
      <RechnungsvorlageClient
        templates={templates as any}
        defaultHtml={DEFAULT_INVOICE_HTML}
        lastTransaction={lastTransaction as any}
      />
    </PageShell>
  )
}
