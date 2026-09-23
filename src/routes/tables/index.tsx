import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/button.tsx'
import { createTable, joinTable, listMyTables } from '#/server/fn/tables.ts'

/** Munda Manager's Input (components/ui/input.tsx there). */
const INPUT_CLASSES =
  'h-10 w-full rounded-md border border-edge bg-muted px-3 py-2 text-base placeholder:text-muted-fg focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-hidden md:text-sm dark:focus-visible:ring-neutral-300'

export const Route = createFileRoute('/tables/')({
  loader: () => listMyTables(),
  component: TablesIndex,
})

function TablesIndex() {
  const myTables = Route.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const table = await createTable({ data: { name } })
    setName('')
    await router.navigate({ to: '/tables/$tableId', params: { tableId: table.id } })
  }

  async function onJoin(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const { tableId } = await joinTable({ data: { joinCode: code } })
      setCode('')
      await router.navigate({ to: '/tables/$tableId', params: { tableId } })
    } catch {
      setError('No table with that join code.')
    }
  }

  return (
    // Laid out as Munda Manager's home page: a card of actions, then a card
    // listing your campaigns (components/home/campaigns-tab.tsx there).
    <main className="mx-auto w-full max-w-4xl space-y-4 px-[10px] py-4">
      <section className="rounded-lg bg-card p-4 shadow-md">
        <h1 className="mb-2 text-xl font-bold md:text-2xl">Tables</h1>
        <p className="mb-4 text-muted-fg">
          Create a table and be its Arbitrator, or join an existing one with a join code.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <form onSubmit={onCreate} className="flex flex-col gap-2">
            <label htmlFor="table-name" className="text-sm font-medium text-muted-fg">
              Run a new table
            </label>
            <input
              id="table-name"
              required
              maxLength={80}
              placeholder="Table name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASSES}
            />
            <Button type="submit" className="h-10 w-full px-4 py-2">
              Create as Arbitrator
            </Button>
          </form>

          <form onSubmit={onJoin} className="flex flex-col gap-2">
            <label htmlFor="join-code" className="text-sm font-medium text-muted-fg">
              Join a table
            </label>
            <input
              id="join-code"
              required
              maxLength={12}
              placeholder="Join code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`font-mono tracking-widest ${INPUT_CLASSES}`}
            />
            <Button type="submit" variant="secondary" className="h-10 w-full px-4 py-2">
              Join as player
            </Button>
          </form>
        </div>
        {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      </section>

      <section className="rounded-lg bg-card p-4 shadow-md">
        <h2 className="mb-4 text-xl font-bold md:text-2xl">Your Tables</h2>
        {myTables.length === 0 ? (
          <p className="text-center text-muted-fg">
            Nothing yet. Create a table to run one, or join with a code.
          </p>
        ) : (
          <ul className="space-y-3">
            {myTables.map((table) => (
              <li key={table.id}>
                <Link
                  to="/tables/$tableId"
                  params={{ tableId: table.id }}
                  className="flex items-center rounded-md p-2 transition-colors duration-200 hover:bg-muted md:p-4"
                >
                  {/* Munda Manager's fallback when a campaign has no image. */}
                  <span
                    aria-hidden
                    className="mr-3 flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-muted text-xl md:mr-4"
                  >
                    {table.name.charAt(0)}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate text-lg font-medium md:text-xl">
                      {table.name}
                    </span>
                    <span className="block text-sm text-muted-fg capitalize md:text-base">
                      {table.role}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
