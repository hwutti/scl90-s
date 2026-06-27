import { getBranding } from '@/lib/branding'
import { LoginClient } from './LoginClient'

export default async function LoginPage() {
  const branding = await getBranding()
  return <LoginClient branding={branding} />
}
