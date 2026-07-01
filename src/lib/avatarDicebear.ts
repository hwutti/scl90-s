// DiceBear-"Avataaars"-SVG-Generierung. NUR serverseitig (Node.js) importieren
// (z.B. in API-Routes) — nutzt fs/path per dynamic import, was in Client-
// Bundles (webpack) zum Build-Fehler "Module not found: Can't resolve 'fs'"
// führt. Deshalb bewusst NICHT in avatarSettings.ts (das wird auch von
// Client-Komponenten wie SettingsClient.tsx importiert).

/**
 * Erzeugt den DiceBear-"Avataaars"-SVG-String für einen einzelnen Seed. Liest
 * die Style-Definition direkt per fs von der Platte statt per ESM-JSON-Import
 * (Import-Attribute werden je nach Next.js/Webpack-Version nicht zuverlässig
 * unterstützt; fs.readFileSync ist unabhängig vom Modul-System und dadurch
 * robuster).
 */
let cachedDefinition: any = null

async function getStyle() {
  const { Style } = await import('@dicebear/core')
  if (!cachedDefinition) {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const definitionPath = join(process.cwd(), 'node_modules', '@dicebear', 'styles', 'dist', 'avataaars.min.json')
    cachedDefinition = JSON.parse(readFileSync(definitionPath, 'utf-8'))
  }
  return new Style(cachedDefinition)
}

export async function generateAvatarSvg(seed: string, backgroundColor?: string): Promise<string> {
  const { Avatar } = await import('@dicebear/core')
  const style = await getStyle()
  const avatar = new Avatar(style, {
    seed,
    ...(backgroundColor ? { backgroundColor: [backgroundColor.replace('#', '')] } : {}),
  })
  return avatar.toString()
}

// Layout-Koordinaten für 2/3/4 Personen in einem 280×280-Kreis (passend zur
// nativen Avataaars-viewBox, damit keine krummen Skalierungsfaktoren entstehen)
const GROUP_LAYOUTS: Record<number, { x: number; y: number; scale: number }[]> = {
  2: [
    { x: -30, y: 40, scale: 0.62 },
    { x: 110, y: 40, scale: 0.62 },
  ],
  3: [
    { x: 70, y: -40, scale: 0.55 },
    { x: -30, y: 110, scale: 0.55 },
    { x: 170, y: 110, scale: 0.55 },
  ],
  4: [
    { x: -10, y: -10, scale: 0.5 },
    { x: 150, y: -10, scale: 0.5 },
    { x: -10, y: 150, scale: 0.5 },
    { x: 150, y: 150, scale: 0.5 },
  ],
}

/**
 * Kombiniert mehrere Einzel-Avatare zu einem Bild (für Paar/Familie/Gruppe).
 * idRandomization:true ist entscheidend — sonst haben alle Avatare dieselben
 * internen <defs>-IDs (Kleidung, Frisur etc.) und überschreiben sich gegenseitig,
 * sobald sie im selben SVG-Dokument verschachtelt werden.
 */
export async function generateGroupAvatarSvg(seeds: string[], backgroundColor?: string): Promise<string> {
  const { Avatar } = await import('@dicebear/core')
  const style = await getStyle()

  const layout = GROUP_LAYOUTS[seeds.length] ?? GROUP_LAYOUTS[Math.min(4, Math.max(2, seeds.length))]

  const individualSvgs = seeds.map(seed => {
    const avatar = new Avatar(style, { seed, idRandomization: true })
    return avatar.toString()
  })

  const bgCircle = backgroundColor
    ? `<circle cx="140" cy="140" r="140" fill="#${backgroundColor.replace('#', '')}"/>`
    : ''

  const groups = individualSvgs.map((svg, i) => {
    const p = layout[i] ?? layout[layout.length - 1]
    return `<g transform="translate(${p.x},${p.y}) scale(${p.scale})">${svg}</g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">` +
    `<clipPath id="group-clip"><circle cx="140" cy="140" r="140"/></clipPath>` +
    bgCircle +
    `<g clip-path="url(#group-clip)">${groups}</g>` +
    `</svg>`
}
