import { getRouteApi } from '@tanstack/react-router'

const rootRoute = getRouteApi('__root__')

/**
 * The root loader's data: the public Supabase config and the current user.
 *
 * Loaded once at the root, so child routes read it from here rather than
 * re-fetching it or taking a dependency on the root route's module.
 */
export function useBootstrap() {
  return rootRoute.useLoaderData()
}
