/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig
