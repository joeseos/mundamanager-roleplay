import { beforeEach, describe, expect, it } from 'vitest'

import { addMember, makeCharacter, makeTable, makeUser, resetDb } from '#/test/db.ts'

import {
  assertCanEditCharacter,
  canSeeCharacter,
  requireArbitrator,
  requireTableAccess,
  visibleCharacters,
} from './authz.ts'
import { HttpError } from './middleware.ts'
import { readActorNames } from './sessionLog.ts'

beforeEach(resetDb)

describe('table access', () => {
  it('resolves the role of a member', async () => {
    const gm = await makeUser('Arbitrator')
    const table = await makeTable(gm)

    await expect(requireTableAccess(gm, table.id)).resolves.toMatchObject({
      role: 'arbitrator',
      tableId: table.id,
    })
  })

  it('hides a table from a non-member as a 404, not a 403', async () => {
    const gm = await makeUser('Arbitrator')
    const stranger = await makeUser('Stranger')
    const table = await makeTable(gm)

    // A stranger should not be able to tell an existing table they cannot see
    // from one that does not exist.
    await expect(requireTableAccess(stranger, table.id)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('refuses arbitrator-only actions to a player', async () => {
    const gm = await makeUser('Arbitrator')
    const player = await makeUser('Player')
    const table = await makeTable(gm)
    await addMember(table, player)

    await expect(requireArbitrator(player, table.id)).rejects.toBeInstanceOf(HttpError)
    await expect(requireArbitrator(player, table.id)).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('character visibility', () => {
  it('shows an Arbitrator every character on their table', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const bob = await makeUser('Bob')
    const table = await makeTable(gm)
    await addMember(table, alice)
    await addMember(table, bob)
    await makeCharacter(table, alice, 'Kal')
    await makeCharacter(table, bob, 'Mad Donna')

    const access = await requireTableAccess(gm, table.id)
    const seen = await visibleCharacters(access)

    expect(seen.map((c) => c.name).sort()).toEqual(['Kal', 'Mad Donna'])
  })

  it('shows a player only their own character', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const bob = await makeUser('Bob')
    const table = await makeTable(gm)
    await addMember(table, alice)
    await addMember(table, bob)
    await makeCharacter(table, alice, 'Kal')
    await makeCharacter(table, bob, 'Mad Donna')

    const access = await requireTableAccess(alice, table.id)
    const seen = await visibleCharacters(access)

    expect(seen.map((c) => c.name)).toEqual(['Kal'])
  })

  it('never leaks a character from another table', async () => {
    const gm = await makeUser('Arbitrator')
    const other = await makeUser('OtherGm')
    const table = await makeTable(gm)
    const otherTable = await makeTable(other, 'Other Table')
    const outsider = await makeCharacter(otherTable, other, 'Outsider')

    const access = await requireTableAccess(gm, table.id)

    expect(canSeeCharacter(access, outsider)).toBe(false)
    expect(await visibleCharacters(access)).toHaveLength(0)
  })
})

describe('character editing', () => {
  it('lets the owner edit their own character', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const table = await makeTable(gm)
    await addMember(table, alice)
    const kal = await makeCharacter(table, alice, 'Kal')

    const access = await requireTableAccess(alice, table.id)
    expect(() => assertCanEditCharacter(access, kal)).not.toThrow()
  })

  /**
   * Editing is deliberately narrower than seeing: an Arbitrator reads every
   * sheet on their table but does not own them.
   */
  it('stops an Arbitrator editing a character they can see', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const table = await makeTable(gm)
    await addMember(table, alice)
    const kal = await makeCharacter(table, alice, 'Kal')

    const access = await requireTableAccess(gm, table.id)

    expect(canSeeCharacter(access, kal)).toBe(true)
    expect(() => assertCanEditCharacter(access, kal)).toThrow(HttpError)
  })

  it('stops a player editing another player character', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const bob = await makeUser('Bob')
    const table = await makeTable(gm)
    await addMember(table, alice)
    await addMember(table, bob)
    const kal = await makeCharacter(table, alice, 'Kal')

    const access = await requireTableAccess(bob, table.id)

    expect(canSeeCharacter(access, kal)).toBe(false)
    expect(() => assertCanEditCharacter(access, kal)).toThrow(HttpError)
  })
})

describe('actor names', () => {
  it('resolves the names of that table members and nobody else', async () => {
    const gm = await makeUser('Arbitrator')
    const alice = await makeUser('Alice')
    const outsider = await makeUser('Outsider')
    const table = await makeTable(gm)
    await addMember(table, alice)
    // Belongs to a table of their own, so they must not appear here.
    await makeTable(outsider)

    const names = await readActorNames(table.id)

    expect(Object.values(names).sort()).toEqual(['Alice', 'Arbitrator'])
  })
})
