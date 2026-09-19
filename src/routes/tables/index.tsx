import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { createTable, joinTable, listMyTables } from '#/server/fn/tables.ts'

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
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <section>
        <h1 className="text-2xl font-bold">Your tables</h1>
        {myTables.length === 0 ? (
          <p className="mt-2 text-stone-400">
            Nothing yet. Create a table to run one, or join with a code.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {myTables.map((table) => (
              <li key={table.id}>
                <Link
                  to="/tables/$tableId"
                  params={{ tableId: table.id }}
                  className="flex items-center justify-between rounded border border-stone-800 p-3 hover:bg-stone-900"
                >
                  <span className="font-medium">{table.name}</span>
                  <span className="text-xs uppercase tracking-wide text-stone-400">
                    {table.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <form onSubmit={onCreate} className="space-y-2">
          <h2 className="font-semibold">Run a new table</h2>
          <input
            required
            maxLength={80}
            placeholder="Table name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded bg-amber-600 px-3 py-2 font-medium text-stone-950"
          >
            Create as Arbitrator
          </button>
        </form>

        <form onSubmit={onJoin} className="space-y-2">
          <h2 className="font-semibold">Join a table</h2>
          <input
            required
            maxLength={12}
            placeholder="Join code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 font-mono tracking-widest"
          />
          <button
            type="submit"
            className="w-full rounded border border-stone-700 px-3 py-2 hover:bg-stone-900"
          >
            Join as player
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </main>
  )
}
