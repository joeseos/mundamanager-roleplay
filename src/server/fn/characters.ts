import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { characters } from '#/db/schema.ts'
import { assertCanEditCharacter, canSeeCharacter, requireTableAccess } from '#/server/authz.ts'
import { HttpError, requireUser } from '#/server/middleware.ts'

/**
 * The sheet is an opaque jsonb blob, so the "placeholder sheet" really is a
 * placeholder: a single free-text field. When the rules are published this is
 * where a real sheet goes, and no migration is needed to put it there.
 */
const PLACEHOLDER_SHEET = { notes: '' }

const sheetSchema = z.object({ notes: z.string().max(20_000) })

export const createCharacter = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tableId: z.uuid(),
      name: z.string().trim().min(1).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    await requireTableAccess(user, data.tableId)

    const [row] = await db
      .insert(characters)
      .values({
        tableId: data.tableId,
        ownerUserId: user.id,
        name: data.name,
        sheet: PLACEHOLDER_SHEET,
      })
      .returning()

    return row!
  })

export const getCharacter = createServerFn({ method: 'GET' })
  .validator(z.object({ characterId: z.uuid() }))
  .handler(async ({ context, data }) => {
    const user = requireUser(context)

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, data.characterId))
      .limit(1)

    if (!character) throw new HttpError(404, 'Character not found')

    const access = await requireTableAccess(user, character.tableId)
    if (!canSeeCharacter(access, character)) {
      throw new HttpError(404, 'Character not found')
    }

    return { character, canEdit: character.ownerUserId === user.id }
  })

export const updateCharacter = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      characterId: z.uuid(),
      name: z.string().trim().min(1).max(80).optional(),
      sheet: sheetSchema.optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, data.characterId))
      .limit(1)

    if (!character) throw new HttpError(404, 'Character not found')

    const access = await requireTableAccess(user, character.tableId)
    // Deliberately narrower than visibility: an Arbitrator reads every sheet
    // on their table but does not own them.
    assertCanEditCharacter(access, character)

    const [row] = await db
      .update(characters)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.sheet ? { sheet: data.sheet } : {}),
        updatedAt: new Date(),
      })
      .where(eq(characters.id, data.characterId))
      .returning()

    return row!
  })
