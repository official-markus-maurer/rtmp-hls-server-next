
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import db from "@/lib/db"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(credentials.email) as any

        if (!user) {
          throw new Error("User not found.")
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string, 
          user.password
        )

        if (!passwordsMatch) {
           throw new Error("Invalid password.")
        }

        return {
          id: String(user.id),
          name: user.username,
          email: user.email,
          image: user.avatar, // Map avatar to image
          streamKey: user.stream_key
        }
      },
    }),
  ],
})
