const { getAllSets } = require('../lib/pokemontcg');

module.exports = async (req, res) => {
  try {
    const sets = await getAllSets();
    const results = sets.map((s) => ({
      id: s.id,
      name: s.name,
      series: (s.serie && s.serie.name) || 'Other',
      releaseDate: s.releaseDate || ''
    }));
    res.status(200).json({ sets: results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
