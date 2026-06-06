// AI Gateway test script
// Uses Vercel AI SDK with AI Gateway via Vercel's OIDC token
// No API key needed when run with VERCEL_OIDC_TOKEN env var

import { streamText } from 'ai'

const result = streamText({
  model: 'openai/gpt-5.5',
  prompt: 'Explain quantum computing in simple terms.',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}

console.log('\n--- Streaming complete ---')
