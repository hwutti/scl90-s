import crypto from 'crypto'

// Liest den 64-Hex-Zeichen ENCRYPTION_KEY aus der .env und gibt ihn als Buffer zurück.
// Wirft wenn der Key fehlt oder ungültig ist.
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? ''
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY muss genau 64 Hex-Zeichen lang sein (32 Bytes = 256 Bit).')
  return Buffer.from(hex, 'hex')
}

export async function encryptBuffer(plain: Buffer): Promise<{ encrypted: Buffer; iv: string }> {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96 Bit IV für GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  // tag (16 Bytes) an den Ciphertext anhängen, damit er beim Entschlüsseln verfügbar ist
  return { encrypted: Buffer.concat([encrypted, tag]), iv: iv.toString('hex') }
}

export async function decryptBuffer(encryptedWithTag: Buffer, ivHex: string): Promise<Buffer> {
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = encryptedWithTag.slice(encryptedWithTag.length - 16)
  const ciphertext = encryptedWithTag.slice(0, encryptedWithTag.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
