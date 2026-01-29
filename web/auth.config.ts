
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        // We cannot use DB here because this runs in Edge Middleware
        // The actual authorization logic with DB will be in auth.ts (Node.js runtime)
        return null; 
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard'); // Example protected route
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }
      return true;
    },
    async jwt({ token, user }) {
        if (user) {
          token.id = user.id
          token.streamKey = (user as any).streamKey
        }
        return token
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as any).id = token.id;
          (session.user as any).streamKey = token.streamKey;
        }
        return session
      },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
