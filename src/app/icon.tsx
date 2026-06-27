import { ImageResponse } from 'next/og'
import { getBranding } from '@/lib/branding'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default async function Icon() {
  const b = await getBranding()
  const color = b.colorPrimary ?? '#166534'
  return new ImageResponse(
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, color: 'white', fontFamily: 'serif',
    }}>
      ψ
    </div>,
    { ...size }
  )
}
