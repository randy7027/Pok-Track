const { Redis } = require('@upstash/redis');

let client = null;

function getRedis() {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars. ' +
      'Add a Redis integration from the Vercel Marketplace and copy its REST URL and token into these two Project env vars.'
    );
  }

  client = new Redis({ url, token });
  return client;
}

module.exports = { getRedis };
