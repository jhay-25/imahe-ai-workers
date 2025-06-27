import type { Context, MiddlewareHandler } from 'hono'
import { S3Client } from '@aws-sdk/client-s3'
import { env } from 'hono/adapter'

type R2Env = {
  R2_ENDPOINT: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
}

export const getR2 = (c: Context) => {
  return c.get('r2')
}

export const r2Middleware: MiddlewareHandler = async (c, next) => {
  const r2Env = env<R2Env>(c)
  const r2Endpoint = r2Env.R2_ENDPOINT
  const r2AccessKeyId = r2Env.R2_ACCESS_KEY_ID
  const r2SecretAccessKey = r2Env.R2_SECRET_ACCESS_KEY

  const r2 = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId!,
      secretAccessKey: r2SecretAccessKey!
    }
  })

  c.set('r2', r2)

  await next()
}
