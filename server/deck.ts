import { Card, HandEvaluation, HandType, Rank, Suit } from '../src/types/game.js';

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: { rank: Rank; value: number }[] = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 },
  { rank: 'A', value: 14 },
];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({
        suit,
        rank: r.rank,
        value: r.value,
      });
    }
  }
  return deck;
}

// Fisher-Yates shuffle
export function shuffleDeck(deck: Card[]): Card[] {
  const array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function evaluateThreeCardHand(cards: Card[]): HandEvaluation {
  if (!cards || cards.length < 3) {
    return {
      type: 'High Card',
      score: 0,
      rankName: 'High card',
      cards: cards || [],
      description: 'Incomplete hand',
    };
  }

  // Sort cards descending by value
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const [c1, c2, c3] = sorted;

  const isFlush = c1.suit === c2.suit && c2.suit === c3.suit;

  // Check straight: e.g. 14, 13, 12 (A-K-Q) or 5, 4, 3 or A, 3, 2 (14, 3, 2)
  let isStraight = false;
  let straightHigh = c1.value;

  if (c1.value === c2.value + 1 && c2.value === c3.value + 1) {
    isStraight = true;
    straightHigh = c1.value;
  } else if (c1.value === 14 && c2.value === 3 && c3.value === 2) {
    // Ace-2-3 sequence
    isStraight = true;
    straightHigh = 3.5; // In classic rules A-2-3 is second highest or special, standard 3.5
  }

  const isThreeOfAKind = c1.value === c2.value && c2.value === c3.value;
  const isPair = c1.value === c2.value || c2.value === c3.value || c1.value === c3.value;

  // Pair logic: identify pair rank & kicker
  let pairValue = 0;
  let kickerValue = 0;
  if (isPair && !isThreeOfAKind) {
    if (c1.value === c2.value) {
      pairValue = c1.value;
      kickerValue = c3.value;
    } else if (c2.value === c3.value) {
      pairValue = c2.value;
      kickerValue = c1.value;
    } else {
      pairValue = c1.value;
      kickerValue = c2.value;
    }
  }

  // Base multiplier for hand tiers:
  // 1. Trail: 6,000,000 + v * 10,000
  // 2. Pure Sequence: 5,000,000 + straightHigh * 10,000
  // 3. Sequence: 4,000,000 + straightHigh * 10,000
  // 4. Color / Flush: 3,000,000 + c1*10000 + c2*100 + c3
  // 5. Pair: 2,000,000 + pairValue*1000 + kickerValue
  // 6. High Card: 1,000,000 + c1*10000 + c2*100 + c3

  if (isThreeOfAKind) {
    return {
      type: 'Trail',
      score: 6000000 + c1.value * 10000,
      rankName: 'Trail / Trio',
      cards: sorted,
      description: `Three of a kind (${c1.rank}'s)`,
    };
  }

  if (isFlush && isStraight) {
    return {
      type: 'Pure Sequence',
      score: 5000000 + straightHigh * 10000,
      rankName: 'Pure Sequence',
      cards: sorted,
      description: `Straight Flush (${c1.rank} high)`,
    };
  }

  if (isStraight) {
    return {
      type: 'Sequence',
      score: 4000000 + straightHigh * 10000,
      rankName: 'Sequence',
      cards: sorted,
      description: `Straight (${c1.rank} high)`,
    };
  }

  if (isFlush) {
    return {
      type: 'Color',
      score: 3000000 + c1.value * 10000 + c2.value * 100 + c3.value,
      rankName: 'Color / Flush',
      cards: sorted,
      description: `Flush (${c1.rank} high)`,
    };
  }

  if (isPair) {
    return {
      type: 'Pair',
      score: 2000000 + pairValue * 1000 + kickerValue,
      rankName: 'Pair',
      cards: sorted,
      description: `Pair of ${pairValue === 14 ? 'A' : pairValue === 13 ? 'K' : pairValue === 12 ? 'Q' : pairValue === 11 ? 'J' : pairValue}'s`,
    };
  }

  return {
    type: 'High Card',
    score: 1000000 + c1.value * 10000 + c2.value * 100 + c3.value,
    rankName: 'High card',
    cards: sorted,
    description: `High Card ${c1.rank}`,
  };
}
