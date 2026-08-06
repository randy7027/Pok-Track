const { getRedis } = require('../lib/redis');
const { getCard, extractMarketPrice } = require('../lib/pokemontcg');
const { sendPush } = require('../lib/notify');
const { evaluateCard } = require('../lib/alerts');

const LIST_KEY = 'watchlist:ids';
const MAX_HISTORY_POINTS = 90;

async function checkOne(redis, id, today) {
  const raw = await redis.get(`card:${id}`);
  if (!raw) return { id, skipped: 'not found' };
  const record = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (record.manual) {
    return { id, skipped: 'manually tracked -- update its price by editing it' };
  }

  const card = await getCard(id);
  const priceInfo = extractMarketPrice(card);
  if (!priceInfo) return { id, skipped: 'no price data available' };

  const price = priceInfo.price;
  const previousPrice = typeof record.lastPrice === 'number' ? record.lastPrice : null;
  const changePercent = previousPrice ? ((price - previousPrice) / previousPrice) * 100 : null;

  const { reasons, shouldAlert, lowestSeen } = evaluateCard(record, price);

  record.history = Array.isArray(record.history) ? record.history : [];
  record.history.push({ date: today, price });
  if (record.history.length > MAX_HISTORY_POINTS) {
    record.history = record.history.slice(-MAX_HISTORY_POINTS);
  }
  record.lowestSeen = lowestSeen;

  const wasAlerting = !!record.alerting;
  const justCrossed = shouldAlert && !wasAlerting;

  if (justCrossed) {
    const symbol = priceInfo.currency === 'EUR' ? '\u20AC' : '$';
    await sendPush(
      `${record.name} \u2014 ${symbol}${price.toFixed(2)}`,
      `${reasons.join(' and ')}.`
    );
  }

  record.alerting = shouldAlert;
  record.alertReasons = reasons;
  record.lastChangePercent = changePercent;
  record.lastPrice = price;
  record.lastChecked = new Date().toISOString();

  await redis.set(`card:${id}`, JSON.stringify(record));
  return { id, price, notified: justCrossed };
}

module.exports = async (req, res) => {
  let redis, ids;
  try {
    redis = getRedis();
    ids = (await redis.smembers(LIST_KEY)) || [];
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Every card is checked concurrently rather than one at a time -- with
  // several cards, doing them sequentially could add up to more than
  // Vercel's per-request time limit, especially if the price API is slow.
  const settled = await Promise.allSettled(ids.map((id) => checkOne(redis, id, today)));
  const results = settled.map((outcome, i) =>
    outcome.status === 'fulfilled' ? outcome.value : { id: ids[i], error: outcome.reason.message }
  );

  res.status(200).json({ checked: ids.length, results });
};
