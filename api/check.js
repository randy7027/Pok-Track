const { getRedis } = require('../lib/redis');
const { getCard, extractMarketPrice } = require('../lib/pokemontcg');
const { sendPush } = require('../lib/notify');

const LIST_KEY = 'watchlist:ids';
const MAX_HISTORY_POINTS = 90;

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
  const results = [];

  for (const id of ids) {
    try {
      const raw = await redis.get(`card:${id}`);
      if (!raw) continue;
      const record = typeof raw === 'string' ? JSON.parse(raw) : raw;

      const card = await getCard(id);
      const priceInfo = extractMarketPrice(card);
      if (!priceInfo) {
        results.push({ id, skipped: 'no price data available' });
        continue;
      }

      const price = priceInfo.price;
      const previousPrice = typeof record.lastPrice === 'number' ? record.lastPrice : null;
      const changePercent = previousPrice ? ((price - previousPrice) / previousPrice) * 100 : null;

      record.history = Array.isArray(record.history) ? record.history : [];
      record.history.push({ date: today, price });
      if (record.history.length > MAX_HISTORY_POINTS) {
        record.history = record.history.slice(-MAX_HISTORY_POINTS);
      }

      const previousLowest = record.lowestSeen != null ? record.lowestSeen : price;
      const isNewLow = price < previousLowest && record.history.length > 1;
      record.lowestSeen = Math.min(previousLowest, price);

      // Rolling average of the last 7 prior daily snapshots (excluding today),
      // used as the baseline for "percentage dip" alerts. Accuracy grows as
      // history accumulates — with only a day or two tracked it's a thin baseline.
      const priorPoints = record.history.slice(0, -1).slice(-7);
      const avg7 = priorPoints.length
        ? priorPoints.reduce((sum, p) => sum + p.price, 0) / priorPoints.length
        : null;

      const hitTarget = record.targetPrice != null && price <= record.targetPrice;
      const hitDip =
        avg7 != null &&
        record.dipPercent != null &&
        price <= avg7 * (1 - record.dipPercent / 100);
      const hitLow = record.alertOnLow && isNewLow;

      const reasons = [];
      if (hitTarget) reasons.push(`at or under your $${record.targetPrice} target`);
      if (hitDip) reasons.push(`down ${record.dipPercent}%+ from its recent average`);
      if (hitLow) reasons.push('a new low since you started tracking it');

      const shouldAlert = reasons.length > 0;
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
      results.push({ id, price, notified: justCrossed });
    } catch (err) {
      results.push({ id, error: err.message });
    }
  }

  res.status(200).json({ checked: ids.length, results });
};
