/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  // Increase body size limit for logo uploads (Base64 encoded)
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default nextConfig
