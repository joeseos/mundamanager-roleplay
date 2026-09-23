import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { useBootstrap } from '#/client/bootstrap.ts'
import { Button } from '#/components/button.tsx'
import { createCharacter, updateCharacter } from '#/server/fn/characters.ts'
import { startSession } from '#/server/fn/sessions.ts'
import { getTableDetail } from '#/server/fn/tables.ts'

/** Munda Manager's Input (components/ui/input.tsx there). */
const INPUT_CLASSES =
  'h-10 w-full rounded-md border border-edge bg-muted px-3 py-2 text-base placeholder:text-muted-fg focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-hidden md:text-sm dark:focus-visible:ring-neutral-300'

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
    // Laid out as Munda Manager's campaign page (components/campaigns/[id]/
    // campaign-page-content.tsx there): a summary card, then one card of sections.
    <main className="mx-auto w-full max-w-5xl space-y-4 px-[10px] py-4">
      <section className="rounded-lg bg-card p-4 shadow-md">
        <h1 className="mb-1 text-xl font-bold break-words md:text-2xl">{table.name}</h1>
        <div className="mb-4 text-sm text-muted-fg">
          <p>
            You are the <span className="capitalize">{role}</span>
          </p>
          {table.joinCode ? (
            <p className="mt-1">
              Join code:{' '}
              <code className="rounded-md bg-muted px-2 py-0.5 font-mono tracking-widest text-fg">
                {table.joinCode}
              </code>
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-x-10 text-sm md:gap-x-20">
          <div className="space-y-2">
            <Stat label="Members" value={members.length} />
            <Stat label="Credits" value={table.partyCredits} />
          </div>
          <div className="space-y-2">
            <Stat label="Loot" value={table.partyLoot.length} />
            <Stat label="Contacts" value={table.partyContacts.length} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-fg">
          Party state is shared by the table, not a sum of the characters.
        </p>
      </section>

      <div className="rounded-lg bg-card p-4 shadow-md">
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Members</h2>
          <div className="overflow-x-auto rounded-md border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge bg-muted">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId} className="border-b border-edge last:border-0">
                    <td className="px-4 py-2">{member.displayName}</td>
                    <td className="px-4 py-2 text-muted-fg capitalize">{member.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">
            {role === 'arbitrator' ? 'Venators' : 'Your Venator'}
          </h2>
          {characters.length === 0 ? (
            <p className="text-center text-muted-fg">No characters yet.</p>
          ) : (
            <ul className="space-y-3">
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
              className={INPUT_CLASSES}
            />
            <Button type="submit" className="h-10 shrink-0 px-4 py-2">
              Create
            </Button>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-center text-muted-fg">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-edge">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge bg-muted">
                    <th className="px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-edge transition-colors last:border-0 hover:bg-muted"
                    >
                      <td className="px-4 py-2">
                        <Link
                          to="/sessions/$sessionId"
                          params={{ sessionId: session.id }}
                          className="font-medium hover:text-muted-fg"
                        >
                          {session.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize">
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {role === 'arbitrator' ? (
            <form onSubmit={onStartSession} className="mt-4 flex gap-2">
              <input
                required
                maxLength={120}
                placeholder="Session title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className={INPUT_CLASSES}
              />
              <Button type="submit" className="h-10 shrink-0 px-4 py-2">
                Start session
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-fg">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
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
    <li className="rounded-md border border-edge p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{character.name}</span>
        {canEdit ? null : (
          <span className="text-xs text-muted-fg">read-only</span>
        )}
      </div>
      <textarea
        value={notes}
        readOnly={!canEdit}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Placeholder sheet -- free text until the rules are published."
        className="mt-2 w-full rounded-md border border-edge bg-muted px-3 py-2 text-sm placeholder:text-muted-fg focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-hidden dark:focus-visible:ring-neutral-300"
      />
      {canEdit ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={saving}
          className="mt-2 h-9 px-3"
        >
          {saving ? 'Saving...' : 'Save sheet'}
        </Button>
      ) : null}
    </li>
  )
}
