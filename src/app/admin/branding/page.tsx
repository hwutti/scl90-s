import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBranding } from '@/lib/branding'
import { PageShell } from '@/components/layout/PageShell'
import { BrandingClient } from './BrandingClient'

export default async function BrandingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/patients')

  const branding = await getBranding()

  return (
    <div className="flex-1 flex flex-col">
      <BrandingClient initial={branding} />
    </div>
  )
}
