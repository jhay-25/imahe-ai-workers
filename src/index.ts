import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  getOpenAi,
  openAiMiddleware,
  supabaseMiddleware,
  getSupabase,
  getR2,
  r2Middleware,
  errorHandler
} from './middlewares'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { HTTPException } from 'hono/http-exception'
import { supabase } from './middlewares/supabase.middleware'
import {
  DeleteObjectCommandOutput,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { r2 } from './middlewares/r2.middleware'
import type { ImageObj, AppType } from './interface'
import { cloudflareRateLimiter } from '@hono-rate-limiter/cloudflare'

const app = new Hono<AppType>().basePath('/api/v1')

app.use(
  cloudflareRateLimiter<AppType>({
    rateLimitBinding: (c) => c.env.RATE_LIMITER,
    keyGenerator: (c) => {
      const { apiKey } = c.req.query()
      console.log('cf-connecting-ip: ', c.req.header('cf-connecting-ip'))

      return apiKey ?? c.req.header('cf-connecting-ip') ?? ''
    }
  })
)

app.get('/', async (c) => {
  return c.json({ message: 'Server is up and running. 👋' })
})

app.use(
  '*',
  cors({
    origin: [
      ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000', 'http://localhost:8787']
        : ['https://imahe.codingjohn.dev'])
    ]
  })
)
app.use('*', openAiMiddleware)
app.use('*', r2Middleware)
app.use('*', supabaseMiddleware)

app.post('/generations', async (c) => {
  try {
    const openai = getOpenAi(c)
    const supabase = getSupabase(c)
    const r2 = getR2(c)

    const { prompt, model }: Pick<ImageObj, 'prompt' | 'model'> =
      await c.req.json()

    const img = await openai.images.generate({
      model,
      prompt,
      n: 1,
      response_format: 'url',
      size: '1024x1024'
    })

    const imageUrl = img?.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('OpenAI did not return a valid image URL')
    }

    const res = await fetch(imageUrl)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const id = crypto.randomUUID()
    const fileName = `${id}.png`

    const r2Url = `https://${c.env.R2_DOMAIN}/${fileName}`

    const { data, error } = await supabase
      .from('images')
      .insert({
        id,
        url: r2Url,
        prompt,
        model
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    const bucket = c.env.R2_BUCKET
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png'
    })

    await r2.send(command)

    return c.json(data)
  } catch (e) {
    // console.error('Error in /generations')
    throw new HTTPException(500, { message: (e as Error).message })
  }
})

app.onError(errorHandler)

export default {
  fetch: app.fetch,
  async scheduled() {
    console.log('Scheduled task started')

    try {
      const { data, error } = await supabase.from('images').select('id, url')

      const images = data as Pick<ImageObj, 'id' | 'url'>[]

      if (error) {
        throw new Error(`Supabase error: ${error.message}`)
      }

      const bucket = process.env.R2_BUCKET!

      interface R2ErrorResponse {
        error: unknown
        url: string
      }

      const r2Res: (DeleteObjectCommandOutput | R2ErrorResponse)[] =
        await Promise.all(
          images.map(async ({ url }) => {
            try {
              const fileName = url.split('/').pop()

              const command = new DeleteObjectCommand({
                Bucket: bucket,
                Key: fileName
              })

              return await r2.send(command)
            } catch (err) {
              return { error: err, url }
            }
          })
        )

      const r2Errors = r2Res.filter((res) => 'error' in res)

      const { error: imagesDeleteError } = await supabase
        .from('images')
        .delete()
        .in(
          'id',
          images
            .filter(({ url }) => !r2Errors.some((err) => err.url === url))
            .map(({ id }) => id)
        )

      if (imagesDeleteError) {
        throw new Error(`Supabase error: ${imagesDeleteError.message}`)
      }

      console.log('cron processed')
    } catch (e) {
      console.log('Error in scheduled task:', (e as Error).message)
    }
  }
}
