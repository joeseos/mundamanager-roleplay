import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { useBootstrap } from '#/client/bootstrap.ts'
import { createCharacter, updateCharacter } from '#/server/fn/characters.ts'
import { startSession } from '#/server/fn/sessions.ts'
import { getTableDetail } from '#/server/fn/tables.ts'

export const Route = createFileRoute('/tables/$tableId')({
  loader: ({ params }) => getTableDetail({ data: { tableId: params.tableId } }),
  component: TableDetail,
})

function TableDetail() {
  const { table, role, members, characters, sessions } = Route.useLoaderData()
  const router = useRouter()
  const [newCharacter, setNewCharacter] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')

  async function onCreateCharacter(event: React.FormEvent) {
    event.preventDefault()
    await createCharacter({ data: { tableId: table.id, name: newCharacter } })
    setNewCharacter('')
    await router.invalidate()
  }

  async function onStartSession(event: React.FormEvent) {
    event.preventDefault()
    const session = await startSession({
      data: { tableId: table.id, title: sessionTitle },
    })
    setSessionTitle('')
    await router.navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: session.id },
    })
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-bold">{table.name}</h1>
        <p className="mt-1 text-sm uppercase tracking-wide text-stone-300">
          You are the {role}
        </p>
        {table.joinCode ? (
          <p className="mt-3 text-sm text-stone-300">
            Join code{' '}
            <code className="rounded bg-stone-900/70 px-2 py-1 font-mono tracking-widest text-amber-400">
              {table.joinCode}
            </code>
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="font-semibold">Party</h2>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-stone-800 bg-stone-950/60 p-3">
            <dt className="text-stone-300">Credits</dt>
            <dd className="text-lg">{table.partyCredits}</dd>
          </div>
          <div className="rounded border border-stone-800 bg-stone-950/60 p-3">
            <dt className="text-stone-300">Loot</dt>
            <dd className="text-lg">{table.partyLoot.length}</dd>
          </div>
          <div className="rounded border border-stone-800 bg-stone-950/60 p-3">
            <dt className="text-stone-300">Contacts</dt>
            <dd className="text-lg">{table.partyContacts.length}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-stone-400">
          Party state is shared by the table, not a sum of the characters.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {members.map((member) => (
            <li key={member.userId} className="flex justify-between">
              <span>{member.displayName}</span>
              <span className="text-stone-300">{member.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">
          {role === 'arbitrator' ? 'Venators' : 'Your Venator'}
        </h2>
        {characters.length === 0 ? (
          <p className="mt-2 text-sm text-stone-300">No characters yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </ul>
        )}

        <form onSubmit={onCreateCharacter} className="mt-4 flex gap-2">
          <input
            required
            maxLength={80}
            placeholder="New Venator name"
            value={newCharacter}
            onChange={(e) => setNewCharacter(e.target.value)}
            className="flex-1 rounded border border-stone-700 bg-stone-900/70 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded bg-amber-600 px-3 py-2 font-medium text-stone-950"
          >
            Create
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-semibold">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-stone-300">No sessions yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: session.id }}
                  className="flex items-center justify-between rounded border border-stone-800 bg-stone-950/60 p-3 hover:bg-stone-900/80"
                >
                  <span>{session.title}</span>
                  <span className="text-xs text-stone-300">{session.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {role === 'arbitrator' ? (
          <form onSubmit={onStartSession} className="mt-4 flex gap-2">
            <input
              required
              maxLength={120}
              placeholder="Session title"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="flex-1 rounded border border-stone-700 bg-stone-900/70 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded bg-amber-600 px-3 py-2 font-medium text-stone-950"
            >
              Start session
            </button>
          </form>
        ) : null}
      </section>
    </main>
  )
}

type CharacterRow = ReturnType<typeof Route.useLoaderData>['characters'][number]

/**
 * The sheet is an opaque jsonb blob until the rules are published, so the
 * placeholder is a single free-text field rather than a guessed layout.
 */
function CharacterCard({ character }: { character: CharacterRow }) {
  const { user } = useBootstrap()
  const router = useRouter()
  const canEdit = user?.id === character.ownerUserId
  const [notes, setNotes] = useState(String(character.sheet.notes ?? ''))
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    await updateCharacter({ data: { characterId: character.id, sheet: { notes } } })
    setSaving(false)
    await router.invalidate()
  }

  return (
    <li className="rounded border border-stone-800 bg-stone-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{character.name}</span>
        {canEdit ? null : (
          <span className="text-xs text-stone-400">read-only</span>
        )}
      </div>
      <textarea
        value={notes}
        readOnly={!canEdit}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Placeholder sheet -- free text until the rules are published."
        className="mt-2 w-full rounded border border-stone-800 bg-stone-900/70 px-3 py-2 text-sm"
      />
      {canEdit ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-2 rounded border border-stone-700 px-3 py-1 text-sm hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save sheet'}
        </button>
      ) : null}
    </li>
  )
}
