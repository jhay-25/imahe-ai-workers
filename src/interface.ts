export interface Bindings {
  ACCOUNT_ID: string
  CLOUDFLARE_URL: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_ENDPOINT: string
  R2_BUCKET: string
  R2_DOMAIN: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  NODE_ENV: string
  RATE_LIMITER: RateLimit
}

export type AppType = {
  Variables: {
    rateLimit: boolean
  }
  Bindings: Bindings
}

export interface ImageObj {
  id: string
  url: string
  prompt: string
  model: string
}
