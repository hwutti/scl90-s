import crypto from 'crypto'

// Liest den 64-Hex-Zeichen ENCRYPTION_KEY aus der .env und gibt ihn als Buffer zurück.
// Wirft eine klare Fehlermeldung, wenn der Key fehlt oder ungültig ist -- bewusst
// KEIN stiller Fallback, da sonst Secrets unverschlüsselt weiterverwendet würden.
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? ''
  if (hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY fehlt oder ist ungültig (muss genau 64 Hex-Zeichen / 32 Byte sein). ' +
      'Bitte in der .env setzen (generieren mit: openssl rand -hex 32).'
    )
  }
  return Buffer.from(hex, 'hex')
}

// Format eines mit encryptString() erzeugten Werts: "iv:tag:ciphertext" (alle hex).
// iv = 12 Byte (24 Hex-Zeichen), tag = 16 Byte (32 Hex-Zeichen), ciphertext beliebig lang.
const ENCRYPTED_FORMAT = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/i

// Verschlüsselt einen String mit AES-256-GCM.
export function encryptString(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

// Entschlüsselt einen mit encryptString() erzeugten Wert. Wirft eine klare Fehlermeldung,
// wenn der Wert nicht im erwarteten Format ist (z.B. noch unverschlüsselter Alt-Bestand
// aus einer Version vor Einführung dieser Verschlüsselung) oder der Key nicht passt --
// bewusst KEIN Klartext-Fallback.
export function decryptString(payload: string): string {
  if (!ENCRYPTED_FORMAT.test(payload)) {
    throw new Error(
      'Wert ist nicht im erwarteten verschlüsselten Format (vermutlich noch unverschlüsselter ' +
      'Alt-Bestand). Bitte im Admin-Bereich neu eingeben, damit er verschlüsselt gespeichert wird.'
    )
  }
  const key = getKey()
  const [ivHex, tagHex, dataHex] = payload.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
