import { createClient } from '@supabase/supabase-js'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}
export const getSupabase = (c: Context): SupabaseClient => {
  return c.get('supabase')
}

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const supabaseMiddleware: MiddlewareHandler = async (c, next) => {
  const supabaseEnv = env<SupabaseEnv>(c)
  const supabaseUrl = supabaseEnv.SUPABASE_URL
  const supabaseServiceRoleKey = supabaseEnv.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL missing!')
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing!')
  }

  c.set('supabase', supabase)

  await next()
}
