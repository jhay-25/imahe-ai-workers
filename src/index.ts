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

type Bindings = {
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
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api/v1')

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

    const { prompt, model } = await c.req.json()

    const img = await openai.images.generate({
      model,
      prompt,
      n: 1,
      response_format: 'url',
      size: '1024x1024'
    })

    const imageUrl = img.data[0].url

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
    console.error('Error in /generations:', e)
    throw new HTTPException(500, { message: (e as Error).message })
  }
})

app.onError(errorHandler)

export default app
