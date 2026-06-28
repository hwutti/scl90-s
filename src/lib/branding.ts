import { prisma } from './prisma'

export interface BrandingConfig {
  praxisName: string
  slogan: string | null
  logoBase64: string | null
  logoMimeType: string | null
  colorPrimary: string
  colorPrimaryLight: string
  colorAccent: string
  imprintHtml: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  bundesland: string
}

export const DEFAULT_BRANDING: BrandingConfig = {
  praxisName: 'Psychotherapeutische Praxis',
  slogan: 'Klinische Diagnostik & Dokumentation',
  logoBase64: null,
  logoMimeType: null,
  colorPrimary: '#4f46e5',
  colorPrimaryLight: '#eef2ff',
  colorAccent: '#4338ca',
  imprintHtml: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  bundesland: 'Kärnten',
}

export async function getBranding(): Promise<BrandingConfig> {
  try {
    const config = await prisma.praxisConfig.findUnique({ where: { key: 'default' } })
    if (!config) return DEFAULT_BRANDING
    return config as BrandingConfig
  } catch {
    return DEFAULT_BRANDING
  }
}

export function brandingToCssVars(b: BrandingConfig): string {
  // Only override in light mode — dark mode keeps its own vars from globals.css
  return `
    --color-primary: ${b.colorPrimary};
    --color-primary-light: ${b.colorPrimaryLight};
    --color-accent: ${b.colorAccent};
  `.trim()
}
