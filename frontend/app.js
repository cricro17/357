const socket = io("https://three57-jtxj.onrender.com");

let playerHand = [];
let selectedIndexes = [];
let currentPhase = null;
let isMyTurn = false;

document.getElementById('create').onclick = () => {
  const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
  socket.emit('createRoom', maxPlayers, (roomCode) => {
    document.getElementById('status').innerText = `Partita creata! Codice stanza: ${roomCode}`;
  });
};

document.getElementById('join').onclick = () => {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('joinRoom', roomCode, (response) => {
    if (response.status === 'ok') {
      document.getElementById('status').innerText = `Sei entrato nella stanza ${roomCode}`;
    } else {
      document.getElementById('status').innerText = response.message;
    }
  });
};

function renderHand(highlightCard = null) {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';

  playerHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.suit}`; // Aggiunge stile carta e colore seme
    cardEl.innerText = `${card.value}${card.suit}`;
    cardEl.onclick = () => toggleCardSelection(index, cardEl);

    // ✅ Evidenziazione per selezione manuale
    if (selectedIndexes.includes(index)) {
      cardEl.style.backgroundColor = 'orange';
    }

    // ✅ Evidenziazione per scarto automatico suggerito
    if (highlightCard && card.value === highlightCard.value && card.suit === highlightCard.suit) {
      cardEl.style.border = '3px solid red';
      cardEl.style.backgroundColor = '#ffdada';
      selectedIndexes = [index]; // seleziona automaticamente
    }

    handDiv.appendChild(cardEl);
  });
}


function toggleCardSelection(index, button) {
  if (selectedIndexes.includes(index)) {
    selectedIndexes = selectedIndexes.filter(i => i !== index);
    button.style.backgroundColor = '';
  } else {
    selectedIndexes.push(index);
    button.style.backgroundColor = 'orange';
  }
}

function updateButtons() {
  document.getElementById('drawBtn').disabled = !(isMyTurn && currentPhase === 'draw');
  document.getElementById('discardBtn').disabled = !(isMyTurn && currentPhase === 'discard');
  document.getElementById('kangBtn').disabled = !isMyTurn;
}

document.getElementById('drawBtn').onclick = () => {
  socket.emit('drawCard');
};

document.getElementById('discardBtn').onclick = () => {
  if (selectedIndexes.length === 0 || selectedIndexes.length > 2) {
    alert('Puoi scartare solo una o due carte uguali.');
    return;
  }

  const selectedCards = selectedIndexes.map(i => playerHand[i]);
  const allSameValue = selectedCards.every(c => c.value === selectedCards[0].value);
  if (!allSameValue) {
    alert('Puoi scartare solo carte identiche.');
    return;
  }

  socket.emit('discardCard', selectedCards);
  selectedIndexes = [];
  document.getElementById('actions').style.display = 'none';
};

document.getElementById('kangBtn').onclick = () => {
  socket.emit('kang');
};

socket.on('initialHand', ({ hand, special }) => {
  playerHand = hand;
  renderHand();
  if (special) {
    document.getElementById('status').innerText = `✨ Hai una combinazione speciale: ${special.combination} (x${special.multiplier})`;
  }
});

socket.on('yourTurn', () => {
  isMyTurn = true;
  currentPhase = 'draw';
  document.getElementById('status').innerText = '🎯 È il tuo turno!';
  document.getElementById('actions').style.display = 'block';
  document.getElementById('autoDiscardBtn').style.display = 'none';
  updateButtons();
});

socket.on('cardDrawn', (card) => {
  console.log('📥 Carta pescata dal server:', card);
  // Aggiungi la carta alla tua mano
  playerHand.push(card);
  currentPhase = 'discard';
  renderHand();
  updateButtons();
});

socket.on('cardDiscarded', (cards) => {
  cards.forEach(card => {
    const index = playerHand.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (index !== -1) playerHand.splice(index, 1);
  });
  selectedIndexes = [];
  renderHand();
  updateButtons();
});

socket.on('cardDiscardedByOther', ({ playerId, cards, playerIndex, localIndex }) => {
  const relativeIndex = (playerIndex - localIndex + 4) % 4;
  let areaId;

  if (relativeIndex === 1) areaId = 'right-discard';
  else if (relativeIndex === 2) areaId = 'top-discard';
  else if (relativeIndex === 3) areaId = 'left-discard';
  else return; // non mostrare se sono io

  const area = document.getElementById(areaId);
  if (!area) return;

  const div = document.createElement('div');
  div.innerText = cards.map(c => `${c.value}${c.suit}`).join(' ');
  area.appendChild(div);
});



socket.on('canAutoDiscard', (card) => {
  isMyTurn = true;
  currentPhase = 'discard';
  document.getElementById('status').innerText = `🔁 Puoi scartare ${card.value} subito`;
  document.getElementById('actions').style.display = 'block';

  const autoBtn = document.getElementById('autoDiscardBtn');
  autoBtn.style.display = 'inline-block';

  renderHand(card);
  updateButtons();

  autoBtn.onclick = () => {
    const cardsToDiscard = selectedIndexes.map(i => playerHand[i]);
    socket.emit('discardCard', cardsToDiscard);
    autoBtn.style.display = 'none';
    document.getElementById('actions').style.display = 'none';
    isMyTurn = false;
    currentPhase = null;
    selectedIndexes = [];
    updateButtons();
  };
});

socket.on('notYourTurn', () => {
  isMyTurn = false;
  currentPhase = null;
  document.getElementById('actions').style.display = 'none';
  document.querySelectorAll('#hand button').forEach(btn => {
    btn.style.border = '';
    btn.style.backgroundColor = '';
  });
  updateButtons();
});

socket.on('gameEnded', ({ winner, reason }) => {
  const msg = winner === socket.id
    ? `🏆 Hai vinto! ${reason}`
    : `💀 ${reason}`;
  document.getElementById('status').innerText = msg;
  document.getElementById('actions').style.display = 'none';
});

function addToDiscardArea(card) {
  const area = document.getElementById('discardedArea');
  const div = document.createElement('div');
  div.className = 'discarded-card';
  div.textContent = `${card.value}${card.suit}`;
  area.appendChild(div);
}
