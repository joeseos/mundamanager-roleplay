import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

/**
 * Defining this file opts out of Start's automatic CSRF protection, so we have
 * to install it ourselves. See the note in the middleware guide:
 * "CSRF protection installs automatically unless you define custom start.ts".
 *
 * Scoped to server functions only. Every mutation in this app is a server
 * function; the server routes (`/api/health`, the SSE stream) are GET-only and
 * non-mutating, and validating them would reject legitimate cross-site
 * navigations into the app.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
