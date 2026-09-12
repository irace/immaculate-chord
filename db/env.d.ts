declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MUSIC_CATALOG_PROVIDER?: string;
    OPENROUTER_API_KEY?: string;
    OPENROUTER_MODEL?: string;
  }
}
