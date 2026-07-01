import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { KooperationspartnerRechnungsvorlageClient } from './KooperationspartnerRechnungsvorlageClient'
import { DEFAULT_INVOICE_HTML } from '@/lib/invoice/template'

export default async function KooperationspartnerRechnungsvorlagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role !== 'ADMIN') redirect('/dashboard')

  const templates = await prisma.cooperationPartnerInvoiceTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  // Letzte Kooperationspartner-Transaktion für Vorschau
  const lastTransaction = await prisma.transaction.findFirst({
    where: { cooperationPartnerId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, referenceNumber: true, transactionDate: true, payerName: true, amountGross: true },
  })

  return (
    <PageShell>
      <KooperationspartnerRechnungsvorlageClient
        templates={templates as any}
        defaultHtml={DEFAULT_INVOICE_HTML}
        lastTransaction={lastTransaction as any}
      />
    </PageShell>
  )
}
