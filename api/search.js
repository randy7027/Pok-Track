const { searchCards, extractMarketPrice } = require('../lib/pokemontcg');

module.exports = async (req, res) => {
  const q = (req.query.q || '').toString().trim();

  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }

  try {
    const cards = await searchCards(`name:${q}*`, 12);
    const results = cards.map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set ? c.set.name : '',
      number: c.number,
      image: c.images ? c.images.small : null,
      price: extractMarketPrice(c)
    }));
    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
