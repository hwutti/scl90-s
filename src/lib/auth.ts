import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  useSecureCookies: false,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
        pin: { label: 'PIN (Patient)', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null

        // PIN-Login (Patienten)
        if (credentials.pin && credentials.pin !== 'undefined') {
          const user = await prisma.user.findUnique({ where: { pin: credentials.pin, active: true } })
          if (!user) return null
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        }

        // E-Mail + Passwort (Therapeuten / Admin)
        if (credentials.email && credentials.email !== 'undefined' && credentials.password && credentials.password !== 'undefined') {
          const user = await prisma.user.findUnique({ where: { email: credentials.email, active: true } })
          if (!user?.passwordHash) return null
          const valid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!valid) return null
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role as Role
        ;(session.user as any).id   = token.id as string
      }
      return session
    },
  },
}
