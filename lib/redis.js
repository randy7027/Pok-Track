const Redis = require('ioredis');

let client = null;

function getRedis() {
  if (client) return client;

  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      'Not set: REDIS_URL. In Vercel: Settings -> Environment Variables -> confirm the name is spelled ' +
      'exactly this way, the value is just the redis://... connection string with nothing extra pasted ' +
      'around it, and the Production checkbox is checked -- then redeploy.'
    );
  }

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000
  });

  // Without this listener, a connection failure can crash the function with
  // an unhandled 'error' event. Real failures still surface normally, as
  // rejected promises on whatever command was running -- each route already
  // catches those.
  client.on('error', () => {});

  return client;
}

module.exports = { getRedis };
