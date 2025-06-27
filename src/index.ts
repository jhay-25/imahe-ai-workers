import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  getOpenAi,
  openAiMiddleware,
  getBucket,
  errorHandler
} from './middlewares'

const app = new Hono().basePath('/api/v1')

app.get('/', async (c) => {
  return c.json({ message: 'Server is up and running. 👋' })
})
app.use(
  '*',
  cors({
    origin: [
      ...(process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000', 'http://localhost:8787']
        : []),
      'https://imahe.codingjohn.dev'
    ]
  })
)
app.use('*', openAiMiddleware)

app.post('/generations', async (c) => {
  const openai = getOpenAi(c)

  const { prompt, model } = await c.req.json()

  const img = await openai.images.generate({
    model,
    prompt,
    n: 1,
    response_format: 'url',
    size: '1024x1024'
  })

  const imageUrl = img.data[0].url

  return c.json({
    id: crypto.randomUUID(),
    url: imageUrl,
    prompt,
    model
  })
})

app.onError(errorHandler)

export default app
