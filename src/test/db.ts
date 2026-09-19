import { sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { characters, tableMembers, tables, users } from '#/db/schema.ts'
import type { Character, Table, TableRole, User } from '#/db/schema.ts'

export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table session_events, sessions, characters, table_members, tables, users restart identity cascade`,
  )
}

let seq = 0

export async function makeUser(displayName: string): Promise<User> {
  seq += 1
  const [row] = await db
    .insert(users)
    .values({
      supabaseUserId: `sub-${seq}-${displayName}`,
      email: `${displayName.toLowerCase()}-${seq}@example.com`,
      displayName,
    })
    .returning()
  return row!
}

export async function makeTable(arbitrator: User, name = 'Test Table'): Promise<Table> {
  seq += 1
  const [row] = await db
    .insert(tables)
    .values({ name, createdByUserId: arbitrator.id, joinCode: `CODE${seq}` })
    .returning()

  await db
    .insert(tableMembers)
    .values({ tableId: row!.id, userId: arbitrator.id, role: 'arbitrator' })

  return row!
}

export async function addMember(
  table: Table,
  user: User,
  role: TableRole = 'player',
): Promise<void> {
  await db.insert(tableMembers).values({ tableId: table.id, userId: user.id, role })
}

export async function makeCharacter(
  table: Table,
  owner: User,
  name: string,
): Promise<Character> {
  const [row] = await db
    .insert(characters)
    .values({ tableId: table.id, ownerUserId: owner.id, name })
    .returning()
  return row!
}
