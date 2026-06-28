import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FinanceClient } from './FinanceClient'

export default async function FinancePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role === 'PATIENT') redirect('/my')
  return <FinanceClient />
}
