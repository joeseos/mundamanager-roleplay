import { createFileRoute, redirect } from '@tanstack/react-router'

/** The old address of /sign-in, kept so bookmarks and old links still land. */
export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    throw redirect({ to: '/sign-in', statusCode: 301 })
  },
})
