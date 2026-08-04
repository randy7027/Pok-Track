const { searchCards, extractMarketPrice } = require('../lib/pokemontcg');

module.exports = async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const setId = (req.query.set || '').toString().trim();

  if (!q && !setId) {
    res.status(400).json({ error: 'Provide a name, a set, or both' });
    return;
  }

  try {
    const clauses = [];
    if (setId) clauses.push(`set.id:${setId}`);
    if (q) clauses.push(`name:${q}*`);
    // Browsing a whole set (set picked, no name typed) needs room for every
    // card in it. Narrowing by name doesn't need nearly as many.
    const pageSize = setId && !q ? 250 : 30;
    const cards = await searchCards(clauses.join(' '), pageSize);
    const results = cards.map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set ? c.set.name : '',
      number: c.number,
      image: c.images ? c.images.small : null,
      price: extractMarketPrice(c)
    }));
    res.status(200).json({ results, total: results.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
