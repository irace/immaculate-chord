import { env } from 'cloudflare:workers';
export function getDb() {
  if (!env.DB) throw new Error('Database is unavailable.');
  return env.DB;
}
export function getGradingConfig() {
  return {
    key: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  };
}
