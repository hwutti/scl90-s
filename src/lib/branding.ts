import { prisma } from './prisma'

export type AppFontFamily = 'system' | 'inter' | 'georgia' | 'palatino' | 'optima' | 'gill-sans'

export const FONT_STACKS: Record<AppFontFamily, string> = {
  'system':    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  'inter':     '"Inter var", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  'georgia':   'Georgia, "Times New Roman", Times, serif',
  'palatino':  '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  'optima':    'Optima, Candara, "Gill Sans", "Gill Sans MT", Calibri, sans-serif',
  'gill-sans': '"Gill Sans MT", "Gill Sans", Calibri, "Trebuchet MS", sans-serif',
}

export const FONT_LABELS: Record<AppFontFamily, string> = {
  'system':    'System (Standard)',
  'inter':     'Inter (modern, klar)',
  'georgia':   'Georgia (elegant, Serifen)',
  'palatino':  'Palatino (klassisch, Serifen)',
  'optima':    'Optima (humanistisch)',
  'gill-sans': 'Gill Sans (freundlich)',
}

export type LoginBoxPosition =
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'middle-left' | 'center'        | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export const LOGIN_POSITION_FLEX: Record<LoginBoxPosition, { justify: string; align: string }> = {
  'top-left':      { justify: 'flex-start', align: 'flex-start' },
  'top-center':    { justify: 'center',     align: 'flex-start' },
  'top-right':     { justify: 'flex-end',   align: 'flex-start' },
  'middle-left':   { justify: 'flex-start', align: 'center' },
  'center':        { justify: 'center',     align: 'center' },
  'middle-right':  { justify: 'flex-end',   align: 'center' },
  'bottom-left':   { justify: 'flex-start', align: 'flex-end' },
  'bottom-center': { justify: 'center',     align: 'flex-end' },
  'bottom-right':  { justify: 'flex-end',   align: 'flex-end' },
}

export interface BrandingConfig {
  praxisName: string
  slogan: string | null
  logoBase64: string | null
  logoMimeType: string | null
  colorPrimary: string
  colorPrimaryLight: string
  colorAccent: string
  colorSidebarText: string
  imprintHtml: string | null
  contactEmail: string
  iban: string
  bic: string
  bankName: string
  taxNumber: string
  vatId: string | null
  contactPhone: string | null
  address: string | null
  bundesland: string
  // Login-Design
  loginBgImageBase64: string | null
  loginBgImageMime: string | null
  loginBgColor: string | null
  loginBoxPosition: LoginBoxPosition
  loginBgOverlay: number
  // App-Typografie
  appFontFamily: AppFontFamily
  appFontSize: number
}

export const DEFAULT_BRANDING: BrandingConfig = {
  praxisName: 'Psychotherapeutische Praxis',
  slogan: 'Klinische Diagnostik & Dokumentation',
  logoBase64: null,
  logoMimeType: null,
  colorPrimary: '#4f46e5',
  colorPrimaryLight: '#eef2ff',
  colorAccent: '#4338ca',
  colorSidebarText: '#475569',
  iban: '',
  bic: '',
  bankName: '',
  taxNumber: '',
  vatId: '',
  imprintHtml: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  bundesland: 'Kärnten',
  loginBgImageBase64: null,
  loginBgImageMime: null,
  loginBgColor: null,
  loginBoxPosition: 'center',
  loginBgOverlay: 0,
  appFontFamily: 'system',
  appFontSize: 14,
}

export async function getBranding(): Promise<BrandingConfig> {
  try {
    const config = await prisma.praxisConfig.findUnique({ where: { key: 'default' } })
    if (!config) return DEFAULT_BRANDING
    return {
      ...DEFAULT_BRANDING,
      ...(config as any),
      loginBoxPosition: (config as any).loginBoxPosition ?? 'center',
      loginBgOverlay: parseFloat((config as any).loginBgOverlay ?? 0),
      appFontFamily: (config as any).appFontFamily ?? 'system',
      appFontSize: parseInt((config as any).appFontSize ?? 14),
    } as BrandingConfig
  } catch {
    return DEFAULT_BRANDING
  }
}

export function brandingToCssVars(b: BrandingConfig): string {
  const fontStack = FONT_STACKS[b.appFontFamily] ?? FONT_STACKS['system']
  const fontSize = Math.min(18, Math.max(13, b.appFontSize ?? 14))
  return `
    --color-primary: ${b.colorPrimary};
    --color-primary-light: ${b.colorPrimaryLight};
    --color-accent: ${b.colorAccent};
    --sb-text: ${b.colorSidebarText ?? '#475569'};
    --font-family: ${fontStack};
    --font-size-base: ${fontSize}px;
    --font-size-sm: ${fontSize - 1}px;
    --font-size-xs: ${fontSize - 2}px;
    --font-size-lg: ${fontSize + 2}px;
  `.trim()
}
