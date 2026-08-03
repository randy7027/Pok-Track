const BASE = 'https://api.pokemontcg.io/v2';

function apiHeaders() {
  const headers = {};
  // Optional — an API key just raises your rate limit, the API works without one.
  // Get a free one at https://dev.pokemontcg.io if you outgrow the keyless limit.
  if (process.env.POKEMONTCG_API_KEY) {
    headers['X-Api-Key'] = process.env.POKEMONTCG_API_KEY;
  }
  return headers;
}

async function searchCards(query, pageSize = 12) {
  const url = `${BASE}/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) {
    throw new Error(`pokemontcg.io search failed (${res.status})`);
  }
  const json = await res.json();
  return json.data || [];
}

async function getCard(id) {
  const url = `${BASE}/cards/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) {
    throw new Error(`pokemontcg.io lookup failed for "${id}" (${res.status})`);
  }
  const json = await res.json();
  return json.data || null;
}

async function getAllSets() {
  const url = `${BASE}/sets`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) {
    throw new Error(`pokemontcg.io sets fetch failed (${res.status})`);
  }
  const json = await res.json();
  const sets = json.data || [];
  // Newest sets first.
  sets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  return sets;
}

// Pulls one representative USD market price off a card, preferring TCGPlayer's
// "market" figure (whichever printing/variant has one), then TCGPlayer "mid"
// as a fallback, then CardMarket's average sell price in EUR as a last resort.
function extractMarketPrice(card) {
  const tcgPrices = card && card.tcgplayer && card.tcgplayer.prices;
  if (tcgPrices) {
    for (const variant of Object.keys(tcgPrices)) {
      const p = tcgPrices[variant];
      if (p && typeof p.market === 'number') {
        return { price: p.market, currency: 'USD', source: 'tcgplayer', variant };
      }
    }
    for (const variant of Object.keys(tcgPrices)) {
      const p = tcgPrices[variant];
      if (p && typeof p.mid === 'number') {
        return { price: p.mid, currency: 'USD', source: 'tcgplayer', variant };
      }
    }
  }

  const cmPrices = card && card.cardmarket && card.cardmarket.prices;
  if (cmPrices && typeof cmPrices.averageSellPrice === 'number') {
    return { price: cmPrices.averageSellPrice, currency: 'EUR', source: 'cardmarket' };
  }

  return null;
}

module.exports = { searchCards, getCard, getAllSets, extractMarketPrice };
