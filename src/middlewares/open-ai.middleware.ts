import type { Context, MiddlewareHandler } from 'hono'
import { OpenAI } from 'openai'

export const getOpenAi = (c: Context): OpenAI => {
  return c.get('openai')
}

export const openAiMiddleware: MiddlewareHandler = async (c, next) => {
  const { apiKey } = c.req.query()

  const openai = new OpenAI({
    apiKey: apiKey ?? ''
  })

  c.set('openai', openai)
  await next()
}
