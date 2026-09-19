import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  publishableKey: string
}

let client: SupabaseClient | null = null

/**
 * The browser-side Supabase client. Used for exactly three things: sign-in,
 * token refresh and sign-out.
 *
 * There is no Supabase client on the server, no Supabase table is ever read,
 * and no RLS policy is involved. This project is an identity provider and
 * nothing else.
 */
export function getSupabaseClient(config: SupabaseConfig): SupabaseClient {
  client ??= createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
