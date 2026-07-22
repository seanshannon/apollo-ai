/**
 * Central LLM configuration
 *
 * Every route that talks to the LLM reads its endpoint, model, and key from
 * here, so the provider can be swapped via environment variables instead of
 * editing four call sites. Defaults preserve the original Abacus.AI proxy
 * setup.
 *
 *   LLM_API_URL   — OpenAI-compatible chat-completions endpoint
 *   LLM_MODEL     — model id for SQL generation and answer summarization
 *   LLM_API_KEY   — bearer token (falls back to ABACUSAI_API_KEY)
 *   EMBEDDINGS_API_URL / EMBEDDINGS_MODEL — embeddings endpoint and model
 */

export interface LLMConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export function getLLMConfig(): LLMConfig {
  return {
    apiUrl: process.env.LLM_API_URL || 'https://apps.abacus.ai/v1/chat/completions',
    apiKey: process.env.LLM_API_KEY || process.env.ABACUSAI_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4.1-mini',
  }
}

export interface EmbeddingsConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export function getEmbeddingsConfig(): EmbeddingsConfig {
  return {
    apiUrl: process.env.EMBEDDINGS_API_URL || 'https://apps.abacus.ai/v1/embeddings',
    apiKey: process.env.LLM_API_KEY || process.env.ABACUSAI_API_KEY || '',
    model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
  }
}
