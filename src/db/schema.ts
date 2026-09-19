import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * A local account, keyed on the Supabase `sub`. `displayName` and `avatarUrl`
 * are seeded from the token on first login and owned locally thereafter, so a
 * change in the other app never overwrites what the player set here.
 *
 * `isAdmin` is the app-global admin role. Table-scoped roles live in
 * `tableMembers`. No role of any kind is ever read from the token.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseUserId: text('supabase_user_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: createdAt(),
})

/**
 * A campaign/group, created and run by an Arbitrator.
 *
 * Party state (credits, loot, contacts) lives here rather than in a separate
 * `parties` table: there is exactly one party per table, and it is shared
 * state rather than a sum of the characters.
 */
export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
  joinCode: text('join_code').notNull().unique(),
  partyCredits: integer('party_credits').notNull().default(0),
  partyLoot: jsonb('party_loot')
    .$type<Array<unknown>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  partyContacts: jsonb('party_contacts')
    .$type<Array<unknown>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
})

export const tableMembers = pgTable(
  'table_members',
  {
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<'arbitrator' | 'player'>().notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tableId, t.userId] }),
    index('table_members_user_idx').on(t.userId),
    check('table_members_role_check', sql`${t.role} in ('arbitrator', 'player')`),
  ],
)

/**
 * A Venator.
 *
 * `sheet` is deliberately opaque. The game's rules are not published, so there
 * is no generic character-sheet schema here to get wrong -- only `name` is
 * normalised, because the table list view needs it.
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sheet: jsonb('sheet')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('characters_table_idx').on(t.tableId)],
)

/**
 * A play session belonging to a table.
 *
 * `nextSeq` is the per-session event sequence allocator. Appending an event
 * does `update sessions set next_seq = next_seq + 1 ... returning next_seq - 1`
 * inside the same transaction as the insert, which row-locks the session and
 * serialises concurrent appends.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: text('status').$type<'active' | 'ended'>().notNull().default('active'),
    nextSeq: integer('next_seq').notNull().default(1),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    index('sessions_table_idx').on(t.tableId),
    check('sessions_status_check', sql`${t.status} in ('active', 'ended')`),
  ],
)

/**
 * The append-only session log: history, replay and SSE transport.
 *
 * This is not event sourcing. Derived state lives in the normal tables above;
 * the log exists so a client that reconnects can catch up from its last `seq`.
 */
export const sessionEvents = pgTable(
  'session_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
  },
  (t) => [unique('session_events_session_seq_unique').on(t.sessionId, t.seq)],
)

export type User = typeof users.$inferSelect
export type Table = typeof tables.$inferSelect
export type TableMember = typeof tableMembers.$inferSelect
export type TableRole = TableMember['role']
export type Character = typeof characters.$inferSelect
export type Session = typeof sessions.$inferSelect
export type SessionEvent = typeof sessionEvents.$inferSelect
