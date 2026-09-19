import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { sessions, tableMembers, tables, users } from '#/db/schema.ts'
import { requireTableAccess, visibleCharacters } from '#/server/authz.ts'
import { HttpError, requireUser } from '#/server/middleware.ts'

// No I, O, 0 or 1: these get read aloud and typed in by hand.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateJoinCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  // 256 is an exact multiple of the 32-character alphabet, so the modulo
  // introduces no bias.
  return Array.from(bytes, (b) => JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]).join('')
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  )
}

export const listMyTables = createServerFn({ method: 'GET' }).handler(
  async ({ context }) => {
    const user = requireUser(context)

    return db
      .select({
        id: tables.id,
        name: tables.name,
        joinCode: tables.joinCode,
        role: tableMembers.role,
        createdAt: tables.createdAt,
      })
      .from(tableMembers)
      .innerJoin(tables, eq(tables.id, tableMembers.tableId))
      .where(eq(tableMembers.userId, user.id))
      .orderBy(desc(tables.createdAt))
  },
)

export const createTable = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const user = requireUser(context)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await db.transaction(async (tx) => {
          const [table] = await tx
            .insert(tables)
            .values({
              name: data.name,
              createdByUserId: user.id,
              joinCode: generateJoinCode(),
            })
            .returning()

          // The creator is the Arbitrator by definition.
          await tx
            .insert(tableMembers)
            .values({ tableId: table!.id, userId: user.id, role: 'arbitrator' })

          return table!
        })
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 4) continue
        throw error
      }
    }

    throw new HttpError(500, 'Could not allocate a join code')
  })

export const joinTable = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      joinCode: z
        .string()
        .min(4)
        .max(12)
        .transform((code) => code.trim().toUpperCase()),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)

    const [table] = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.joinCode, data.joinCode))
      .limit(1)

    if (!table) {
      throw new HttpError(404, 'No table with that join code')
    }

    // Re-joining is a no-op rather than an error, and never demotes an
    // Arbitrator who pastes their own code.
    await db
      .insert(tableMembers)
      .values({ tableId: table.id, userId: user.id, role: 'player' })
      .onConflictDoNothing()

    return { tableId: table.id }
  })

export const getTableDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ tableId: z.uuid() }))
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    const access = await requireTableAccess(user, data.tableId)

    const [table] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, data.tableId))
      .limit(1)

    if (!table) throw new HttpError(404, 'Table not found')

    const [members, characterRows, sessionRows] = await Promise.all([
      db
        .select({
          userId: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          role: tableMembers.role,
        })
        .from(tableMembers)
        .innerJoin(users, eq(users.id, tableMembers.userId))
        .where(eq(tableMembers.tableId, data.tableId)),
      visibleCharacters(access),
      db
        .select()
        .from(sessions)
        .where(eq(sessions.tableId, data.tableId))
        .orderBy(desc(sessions.startedAt)),
    ])

    return {
      table: {
        id: table.id,
        name: table.name,
        // The join code is how a player gets in, so only the Arbitrator sees it.
        joinCode: access.role === 'arbitrator' ? table.joinCode : null,
        partyCredits: table.partyCredits,
        partyLoot: table.partyLoot,
        partyContacts: table.partyContacts,
      },
      role: access.role,
      members,
      characters: characterRows,
      sessions: sessionRows,
    }
  })
