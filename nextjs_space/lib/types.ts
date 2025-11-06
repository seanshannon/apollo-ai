
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      firstName?: string
      lastName?: string
      role?: string
      image?: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    firstName?: string
    lastName?: string
    role?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    firstName?: string
    lastName?: string
  }
}
