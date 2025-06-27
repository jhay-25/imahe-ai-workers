import type { Context, MiddlewareHandler } from 'hono'
import { S3Client } from '@aws-sdk/client-s3'

export const getBucket = (c: Context) => {
  return c.get('r2')
}

export const bucketMiddleware: MiddlewareHandler = async (c, next) => {
  const currentPath = c.req.path

  if (currentPath.includes('/api/public')) {
    next()
  }

  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
  })

  c.set('r2', r2)

  await next()
}
