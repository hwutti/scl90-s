/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'xlsx'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig
