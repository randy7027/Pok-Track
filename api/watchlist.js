const { getRedis } = require('../lib/redis');
const { getCard, extractMarketPrice } = require('../lib/pokemontcg');
const { evaluateCard } = require('../lib/alerts');

const LIST_KEY = 'watchlist:ids';

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function toNumberOrNull(v) {
  return v !== '' && v != null ? Number(v) : null;
}

module.exports = async (req, res) => {
  try {
    const redis = getRedis();

    if (req.method === 'GET') {
      const ids = (await redis.smembers(LIST_KEY)) || [];
      const cards = [];
      for (const id of ids) {
        const raw = await redis.get(`card:${id}`);
        if (!raw) continue;
        cards.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      }
      cards.sort((a, b) => a.name.localeCompare(b.name));
      res.status(200).json({ cards });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { id, targetPrice, dipPercent, alertOnLow, manual, name, set, price } = body;
      const today = new Date().toISOString().slice(0, 10);
      let record;

      if (manual) {
        if (!name) {
          res.status(400).json({ error: 'Missing card name' });
          return;
        }
        const manualId = 'manual:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const startPrice = toNumberOrNull(price);
        record = {
          id: manualId,
          name: name,
          set: set || '',
          number: '',
          image: null,
          manual: true,
          targetPrice: toNumberOrNull(targetPrice),
          dipPercent: toNumberOrNull(dipPercent),
          alertOnLow: !!alertOnLow,
          currency: 'USD',
          history: startPrice != null ? [{ date: today, price: startPrice }] : [],
          lowestSeen: startPrice,
          lastPrice: startPrice,
          lastChangePercent: null,
          lastChecked: new Date().toISOString(),
          alerting: false,
          alertReasons: []
        };
      } else {
        if (!id) {
          res.status(400).json({ error: 'Missing card id' });
          return;
        }
        const card = await getCard(id);
        if (!card) {
          res.status(404).json({ error: 'Card not found' });
          return;
        }
        const priceInfo = extractMarketPrice(card);
        record = {
          id: card.id,
          name: card.name,
          set: card.set ? card.set.name : '',
          number: card.number,
          image: card.images ? card.images.small : null,
          manual: false,
          targetPrice: toNumberOrNull(targetPrice),
          dipPercent: toNumberOrNull(dipPercent),
          alertOnLow: !!alertOnLow,
          currency: priceInfo ? priceInfo.currency : 'USD',
          history: priceInfo ? [{ date: today, price: priceInfo.price }] : [],
          lowestSeen: priceInfo ? priceInfo.price : null,
          lastPrice: priceInfo ? priceInfo.price : null,
          lastChangePercent: null,
          lastChecked: new Date().toISOString(),
          alerting: false,
          alertReasons: []
        };
      }

      await redis.set(`card:${record.id}`, JSON.stringify(record));
      await redis.sadd(LIST_KEY, record.id);
      res.status(200).json({ card: record });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      const { id, targetPrice, dipPercent, alertOnLow, price } = body;

      if (!id) {
        res.status(400).json({ error: 'Missing card id' });
        return;
      }

      const raw = await redis.get(`card:${id}`);
      if (!raw) {
        res.status(404).json({ error: 'This card is not on your watchlist' });
        return;
      }
      const record = typeof raw === 'string' ? JSON.parse(raw) : raw;

      record.targetPrice = toNumberOrNull(targetPrice);
      record.dipPercent = toNumberOrNull(dipPercent);
      record.alertOnLow = !!alertOnLow;

      // Manual cards have no automatic price feed -- editing is also how
      // their price gets refreshed, so re-run the same alert logic the
      // daily check uses whenever a new price comes in.
      if (record.manual) {
        const newPrice = toNumberOrNull(price);
        if (newPrice != null) {
          const today = new Date().toISOString().slice(0, 10);
          const previousPrice = typeof record.lastPrice === 'number' ? record.lastPrice : null;
          const changePercent = previousPrice ? ((newPrice - previousPrice) / previousPrice) * 100 : null;
          const { reasons, lowestSeen } = evaluateCard(record, newPrice);

          record.history = Array.isArray(record.history) ? record.history : [];
          record.history.push({ date: today, price: newPrice });
          if (record.history.length > 90) record.history = record.history.slice(-90);
          record.lowestSeen = lowestSeen;
          record.alerting = reasons.length > 0;
          record.alertReasons = reasons;
          record.lastChangePercent = changePercent;
          record.lastPrice = newPrice;
          record.lastChecked = new Date().toISOString();
        }
      }

      await redis.set(`card:${id}`, JSON.stringify(record));
      res.status(200).json({ card: record });
      return;
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id || '').toString();
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      await redis.srem(LIST_KEY, id);
      await redis.del(`card:${id}`);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
