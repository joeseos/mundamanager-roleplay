import type { AppUser } from './middleware.ts'

/** The user fields the browser is allowed to see. */
export interface PublicUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  isAdmin: boolean
}

export function toPublicUser(user: AppUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
  }
}
