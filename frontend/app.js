const socket = io("https://three57-jtxj.onrender.com");

let playerHand = [];
let selectedIndexes = [];
let currentPhase = null;
let isMyTurn = false;
let localPlayerIndex = null;

const discardMap = ["bottom", "right", "top", "left"];
const startBtn = document.getElementById("startBtn");
const startWrapper = document.getElementById("start-wrapper");

// === GESTIONE LOBBY ===
document.getElementById('create').onclick = () => {
  const playerName = document.getElementById('player-name').value.trim();
  if (!playerName) return alert("Inserisci il tuo nome");
  socket.emit('createGame', playerName);
};

document.getElementById('join').onclick = () => {
  const playerName = document.getElementById('player-name').value.trim();
  const roomCode = document.getElementById('game-id').value.trim();
  if (!playerName || !roomCode) return alert("Inserisci nome e codice stanza");
  socket.emit('joinGame', { gameId: roomCode, playerName });
};

// === START GAME ===
startBtn.onclick = () => {
  socket.emit('startGame');
};

// === GESTIONE MANO ===
function renderHand(highlightCard = null) {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';

  playerHand.forEach((card, index) => {
    const btn = document.createElement('button');
    btn.className = `card ${card.suit}`;
    btn.innerText = `${card.value}${card.suit}`;
    btn.onclick = () => toggleCardSelection(index, btn);

    if (selectedIndexes.includes(index)) btn.style.backgroundColor = 'orange';
    if (highlightCard && card.value === highlightCard.value) {
      btn.style.border = '3px solid red';
      btn.style.backgroundColor = '#ffdada';
      selectedIndexes = [index];
    }

    handDiv.appendChild(btn);
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

function renderBacks(playerId, index, total) {
  const relative = (index - localPlayerIndex + total) % total;
  const pos = discardMap[relative];
  const handDiv = document.getElementById(`${pos}-hand`);
  if (!handDiv || playerId === socket.id) return;

  handDiv.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const back = document.createElement('div');
    back.className = 'card back';
    handDiv.appendChild(back);
  }
}

// === BOTTONI AZIONE ===
document.getElementById('drawBtn').onclick = () => {
  socket.emit('drawCard');
};

document.getElementById('discardBtn').onclick = () => {
  if (selectedIndexes.length === 0 || selectedIndexes.length > 2) {
    alert('Puoi scartare solo una o due carte uguali.');
    return;
  }

  const selectedCards = selectedIndexes.map(i => playerHand[i]);
  const same = selectedCards.every(c => c.value === selectedCards[0].value);
  if (!same) {
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

// === SOCKET EVENTS ===
socket.on('gameCreated', ({ gameId, players }) => {
  console.log("✅ Stanza creata:", gameId);
  document.getElementById('game-id').value = gameId;
  document.getElementById('start-wrapper').classList.remove('hidden');
});

socket.on('playerJoined', ({ players }) => {
  console.log("👥 Giocatori nella stanza:", players);
  document.getElementById("status").innerText = `${players.length} giocatori collegati`;
});

socket.on('initialHand', ({ hand, special, playerIndex, totalPlayers, allPlayers }) => {
  playerHand = hand;
  renderHand();
  localPlayerIndex = playerIndex;

  allPlayers.forEach((pid, i) => renderBacks(pid, i, totalPlayers));

  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');

  const status = document.getElementById('status');
  if (special) {
    status.innerText = `✨ Combinazione: ${special.combination} (x${special.multiplier})`;
  } else {
    status.innerText = "🃏 Nessuna combinazione speciale";
  }

  startWrapper.classList.add("hidden");
});

socket.on('yourTurn', () => {
  isMyTurn = true;
  currentPhase = 'draw';
  document.getElementById('status').innerText = '🎯 È il tuo turno!';
  document.getElementById('actions').style.display = 'flex';
  updateButtons();
});

socket.on('cardDrawn', (card) => {
  playerHand.push(card);
  currentPhase = 'discard';
  renderHand();
  updateButtons();
});

socket.on('cardDiscarded', (cards) => {
  cards.forEach(card => {
    const idx = playerHand.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (idx !== -1) playerHand.splice(idx, 1);
  });
  selectedIndexes = [];
  renderHand();
  updateButtons();
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

function updateButtons() {
  document.getElementById('drawBtn').disabled = !(isMyTurn && currentPhase === 'draw');
  document.getElementById('discardBtn').disabled = !(isMyTurn && currentPhase === 'discard');
  document.getElementById('kangBtn').disabled = !isMyTurn;
}
