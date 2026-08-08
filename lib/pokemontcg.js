// Talks to TCGdex (api.tcgdex.net) -- free, no API key, open-source Pokemon
// TCG database. Swapped from pokemontcg.io, which is being sunset in favor
// of a paid successor (Scrydex) and had grown increasingly unreliable.
// Kept this filename to avoid touching every file that imports it.
const BASE = 'https://api.tcgdex.net/v2/en';

async function searchCards(query) {
  const url = `${BASE}/cards?name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGdex search failed (${res.status})`);
  }
  const cards = await res.json();
  return cards || [];
}

// Fetching a set returns the set plus its full card list embedded --
// simpler and more reliable than trying to filter the global cards
// endpoint by a nested set field.
async function getSet(setId) {
  const url = `${BASE}/sets/${encodeURIComponent(setId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGdex set lookup failed for "${setId}" (${res.status})`);
  }
  return await res.json();
}

async function getCard(id, attempt) {
  attempt = attempt || 1;
  const url = `${BASE}/cards/${encodeURIComponent(id)}`;
  const res = await fetch(url);

  if (res.status >= 500 && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getCard(id, attempt + 1);
  }
  if (res.status === 404) {
    throw new Error(`"${id}" isn't in TCGdex's database -- if this card tracked fine before the data source swap, try re-adding it via search`);
  }
  if (!res.ok) {
    throw new Error(`TCGdex lookup failed for "${id}" (${res.status})`);
  }
  return await res.json();
}

async function getAllSets() {
  const url = `${BASE}/sets`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGdex sets fetch failed (${res.status})`);
  }
  const sets = await res.json();
  sets.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
  return sets;
}

// TCGdex image URLs come back with no extension -- you append quality
// (high/low) and a format yourself. Low is the recommended choice for
// thumbnails/lists.
function imageUrl(base, quality) {
  return base ? `${base}/${quality || 'low'}.webp` : null;
}

// Pulls one representative price off a full card object, preferring
// TCGPlayer's market figure (whichever printing has one), then TCGPlayer
// mid as a fallback, then CardMarket's average as a last resort.
function extractMarketPrice(card) {
  const tcg = card && card.pricing && card.pricing.tcgplayer;
  if (tcg) {
    for (const variant of Object.keys(tcg)) {
      if (variant === 'updated' || variant === 'unit') continue;
      const p = tcg[variant];
      if (p && typeof p.marketPrice === 'number') {
        return { price: p.marketPrice, currency: 'USD', source: 'tcgplayer', variant };
      }
    }
    for (const variant of Object.keys(tcg)) {
      if (variant === 'updated' || variant === 'unit') continue;
      const p = tcg[variant];
      if (p && typeof p.midPrice === 'number') {
        return { price: p.midPrice, currency: 'USD', source: 'tcgplayer', variant };
      }
    }
  }

  const cm = card && card.pricing && card.pricing.cardmarket;
  if (cm) {
    for (const variant of Object.keys(cm)) {
      if (variant === 'updated' || variant === 'unit') continue;
      const p = cm[variant];
      if (p && typeof p.avg === 'number') {
        return { price: p.avg, currency: 'EUR', source: 'cardmarket', variant };
      }
    }
  }

  return null;
}

module.exports = { searchCards, getSet, getCard, getAllSets, extractMarketPrice, imageUrl };
