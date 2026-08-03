const { Redis } = require('@upstash/redis');

let client = null;

function getRedis() {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const missing = [];
  if (!url) missing.push('UPSTASH_REDIS_REST_URL');
  if (!token) missing.push('UPSTASH_REDIS_REST_TOKEN');

  if (missing.length) {
    throw new Error(
      `Not set: ${missing.join(', ')}. In Vercel: Settings -> Environment Variables -> confirm the name is spelled ` +
      `exactly this way, has a value, and the Production checkbox is checked -- then redeploy.`
    );
  }

  client = new Redis({ url, token });
  return client;
}

module.exports = { getRedis };
