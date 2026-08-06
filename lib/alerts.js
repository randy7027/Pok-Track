// Given a card's stored record (with its PRE-update history/lowestSeen) and a
// freshly observed price, works out which alert conditions are met. Doesn't
// mutate anything -- the caller appends the new history point and saves.
function evaluateCard(record, price) {
  const priorPoints = (record.history || []).slice(-7);
  const avg7 = priorPoints.length
    ? priorPoints.reduce((sum, p) => sum + p.price, 0) / priorPoints.length
    : null;

  const previousLowest = record.lowestSeen != null ? record.lowestSeen : price;
  const isNewLow = price < previousLowest && (record.history || []).length > 0;
  const lowestSeen = Math.min(previousLowest, price);

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

  return { reasons, shouldAlert: reasons.length > 0, lowestSeen };
}

module.exports = { evaluateCard };
