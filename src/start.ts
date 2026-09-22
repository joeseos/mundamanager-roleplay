import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { HttpError, authMiddleware } from '#/server/middleware.ts'

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

/**
 * Start captures a thrown error as a value rather than rethrowing it, so the
 * response status is whatever the ambient response says -- 200 -- unless it is
 * set here. Only a function middleware sees the throw.
 */
const serverFnStatusMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof HttpError) setResponseStatus(error.status)
      throw error
    }
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, authMiddleware],
  functionMiddleware: [serverFnStatusMiddleware],
}))
