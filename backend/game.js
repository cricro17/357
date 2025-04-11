function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealHand(deck) {
  return deck.splice(0, 5);
}

function evaluateHand(hand) {
  const valuesOnly = hand.map(card => card.value);
  const suitsOnly = hand.map(card => card.suit);
  const valueCount = {};

  for (const value of valuesOnly) {
    valueCount[value] = (valueCount[value] || 0) + 1;
  }

  const isSameSuit = suitsOnly.every(s => s === suitsOnly[0]);
  const valueOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const sortedIndexes = valuesOnly.map(v => valueOrder.indexOf(v)).sort((a, b) => a - b);
  const isSequence = sortedIndexes.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1);

  if (valuesOnly.every(v => ['3', '5', '8'].includes(v))) return { combination: '358', multiplier: 16 };
  if (isSequence && isSameSuit && valuesOnly.includes('10') && valuesOnly.includes('A')) return { combination: 'Scala Reale', multiplier: 15 };
  if (isSequence && isSameSuit) return { combination: 'Scala Colore', multiplier: 10 };
  if (Object.values(valueCount).includes(4)) return { combination: 'Poker', multiplier: 10 };
  if (isSameSuit) return { combination: 'Colore', multiplier: 5 };
  if (isSequence) return { combination: 'Scala', multiplier: 5 };
  if (valuesOnly.every(v => ['A', 'K', 'Q', 'J', '10'].includes(v))) return { combination: '50', multiplier: 5 };
  if (Object.values(valueCount).includes(3)) return { combination: 'Tris', multiplier: 3 };

  return null;
}

module.exports = {
  createDeck,
  shuffle,
  dealHand,
  evaluateHand
};
