import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

export const isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
  : null
