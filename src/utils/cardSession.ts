export type CardGame = 'pokemon' | 'yugioh';

export type CardIdentity = {
  game: CardGame;
  providerId: string;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  printedCode?: string;
  rarity?: string;
  language: string;
  finish?: string;
  edition?: string;
};

export type CardDisposition = 'Sell Individually' | 'Playset' | 'Bundle' | 'Hold';

function normalized(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
}

export function cardDuplicateKey(card: CardIdentity) {
  return [
    card.game,
    card.providerId,
    card.printedCode || card.collectorNumber,
    card.setCode,
    card.rarity,
    card.language,
    card.finish,
    card.edition,
  ].map(normalized).join('|');
}

export function countExactDuplicates(cards: CardIdentity[], target: CardIdentity) {
  const key = cardDuplicateKey(target);
  return cards.filter((card) => cardDuplicateKey(card) === key).length;
}

export function recommendCardDisposition(args: {
  referencePrice?: number;
  exactCopies: number;
  minimumSinglePrice?: number;
}): { disposition: CardDisposition; reason: string } {
  const minimum = Math.max(0, args.minimumSinglePrice ?? 5);
  const price = args.referencePrice;

  if (price !== undefined && price >= minimum) {
    return { disposition: 'Sell Individually', reason: `Reference value meets the $${minimum.toFixed(2)} single-card floor.` };
  }
  if (args.exactCopies >= 3) {
    return { disposition: 'Playset', reason: 'Three or more exact printings can be offered together as a playset.' };
  }
  if (args.exactCopies >= 2) {
    return { disposition: 'Bundle', reason: 'Low-value exact duplicates are usually more efficient as one lot.' };
  }
  return { disposition: 'Hold', reason: 'Keep this low-value or unpriced single for a future set or themed lot.' };
}

export function buildCardListingCopy(card: CardIdentity, condition: string) {
  const identifier = card.printedCode || [card.setCode, card.collectorNumber].filter(Boolean).join(' ') || undefined;
  const gameName = card.game === 'pokemon' ? 'Pokemon TCG' : 'Yu-Gi-Oh! TCG';
  const title = [card.name, card.setName, identifier, card.rarity, card.finish]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const description = [
    `${gameName} single card: ${card.name}`,
    card.setName ? `Set: ${card.setName}` : '',
    identifier ? `Card number/code: ${identifier}` : '',
    card.rarity ? `Rarity: ${card.rarity}` : '',
    card.finish ? `Finish: ${card.finish}` : '',
    card.edition ? `Edition: ${card.edition}` : '',
    `Language: ${card.language}`,
    `Condition: ${condition}`,
    'The photographed card is the card included. Review the front and back photos for exact condition.',
  ].filter(Boolean).join('\n');
  return { title, description };
}
