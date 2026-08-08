const { searchCards, getSet, imageUrl } = require('../lib/pokemontcg');

module.exports = async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const setId = (req.query.set || '').toString().trim();

  if (!q && !setId) {
    res.status(400).json({ error: 'Provide a name, a set, or both' });
    return;
  }

  try {
    let cards = [];
    let setName = '';

    if (setId) {
      const set = await getSet(setId);
      cards = set.cards || [];
      setName = set.name || '';
      if (q) {
        const needle = q.toLowerCase();
        cards = cards.filter((c) => c.name && c.name.toLowerCase().includes(needle));
      }
    } else {
      cards = await searchCards(q);
    }

    // TCGdex's list/brief endpoints don't include pricing (only a full
    // single-card lookup does) -- results show name/image only, price
    // fills in once a card is actually tracked.
    const results = cards.slice(0, 250).map((c) => ({
      id: c.id,
      name: c.name,
      set: setName,
      number: c.localId || '',
      image: imageUrl(c.image, 'low'),
      price: null
    }));

    res.status(200).json({ results, total: results.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
