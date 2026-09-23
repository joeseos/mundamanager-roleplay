import { Link } from '@tanstack/react-router'

/** Shown for any URL no route matches, in place of TanStack's bare "Not Found". */
export function NotFound() {
  return (
    <main className="flex flex-col items-center px-4 pt-14 pb-8 text-center text-white">
      <h1 className="mb-2 text-2xl font-medium">Page not found</h1>
      <p className="mb-8 text-sm">The page you were looking for doesn&apos;t exist.</p>
      <Link to="/" className="text-sm font-medium underline">
        Go home
      </Link>
    </main>
  )
}
