const { getRedis } = require('../lib/redis');
const { getCard, extractMarketPrice } = require('../lib/pokemontcg');

const LIST_KEY = 'watchlist:ids';

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
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
      const { id, targetPrice, dipPercent, alertOnLow } = body;

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
      const today = new Date().toISOString().slice(0, 10);

      const record = {
        id: card.id,
        name: card.name,
        set: card.set ? card.set.name : '',
        number: card.number,
        image: card.images ? card.images.small : null,
        targetPrice: targetPrice !== '' && targetPrice != null ? Number(targetPrice) : null,
        dipPercent: dipPercent !== '' && dipPercent != null ? Number(dipPercent) : null,
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

      await redis.set(`card:${card.id}`, JSON.stringify(record));
      await redis.sadd(LIST_KEY, card.id);

      res.status(200).json({ card: record });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      const { id, targetPrice, dipPercent, alertOnLow } = body;

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

      record.targetPrice = targetPrice !== '' && targetPrice != null ? Number(targetPrice) : null;
      record.dipPercent = dipPercent !== '' && dipPercent != null ? Number(dipPercent) : null;
      record.alertOnLow = !!alertOnLow;

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
