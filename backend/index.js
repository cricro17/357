// ✅ index.js - BACKEND COMPLETO
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { createDeck, dealHands, evaluateHand } = require('./game');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

io.on('connection', (socket) => {
  console.log('✅ Connesso:', socket.id);

  socket.on('createRoom', (maxPlayers, callback) => {
    const code = uuidv4().slice(0, 6);
    rooms[code] = {
      players: [socket.id],
      maxPlayers,
    };
    socket.join(code);
    callback(code);
  });

  socket.on('joinRoom', (code, callback) => {
    const room = rooms[code];
    if (room && room.players.length < room.maxPlayers) {
      room.players.push(socket.id);
      socket.join(code);
      callback({ status: 'ok' });

      if (room.players.length === room.maxPlayers) {
        startGame(code);
      }
    } else {
      callback({ status: 'error', message: 'Errore nel join' });
    }
  });

  socket.on('drawCard', () => {
    const code = findPlayerRoom(socket.id);
    const room = rooms[code];
    if (!room || room.phase !== 'draw' || getCurrentPlayer(room) !== socket.id) return;

    const card = room.deck.shift();
    room.hands[socket.id].push(card);
    room.phase = 'discard';
    io.to(socket.id).emit('cardDrawn', card);
  });

  socket.on('discardCard', (cards) => {
    const code = findPlayerRoom(socket.id);
    const room = rooms[code];
    if (!room || room.phase !== 'discard' || getCurrentPlayer(room) !== socket.id) return;

    const hand = room.hands[socket.id];
    const cardList = Array.isArray(cards) ? cards : [cards];

    cardList.forEach(c => {
      const i = hand.findIndex(h => h.value === c.value && h.suit === c.suit);
      if (i !== -1) hand.splice(i, 1);
    });

    room.lastDiscarded = { value: cardList[0].value };
    io.to(socket.id).emit('cardDiscarded', cardList);

    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const next = getCurrentPlayer(room);
    const nextHand = room.hands[next];

    room.phase = 'draw';
    room.players.forEach(pid => io.to(pid).emit('notYourTurn'));

    const match = nextHand.find(c => c.value === room.lastDiscarded.value);
    if (match) {
      room.phase = 'discard';
      io.to(next).emit('canAutoDiscard', match);
    } else {
      io.to(next).emit('yourTurn');
    }
  });
  socket.on('kang', () => {
    const roomCode = findPlayerRoom(socket.id);
    const room = rooms[roomCode];
    if (!room || !room.hands) return;
  
    // Calcola i punteggi per ogni giocatore
    const scores = room.players.map(pid => {
      const hand = room.hands[pid];
      return {
        playerId: pid,
        score: calculatePoints(hand)
      };
    });
  
    // Trova il punteggio minimo
    const winner = scores.reduce((min, p) => p.score < min.score ? p : min, scores[0]);
  
    // Annuncia il vincitore a tutti
    room.players.forEach(pid => {
      io.to(pid).emit('gameEnded', {
        winner: winner.playerId,
        reason: `ha vinto con ${winner.score} punti!`
      });
    });
  });
});

function startGame(code) {
  const room = rooms[code];
  const deck = createDeck();
  const hands = dealHands(deck, room.maxPlayers);

  room.hands = {};
  room.turnIndex = 0;
  room.phase = 'draw';
  room.deck = deck;
  room.lastDiscarded = null;

  let winner = false;

  room.players.forEach((pid, i) => {
    const hand = hands[i];
    const result = evaluateHand(hand);
    room.hands[pid] = hand;

    io.to(pid).emit('initialHand', { hand, special: result });

    if (result) {
      room.players.forEach(p => {
        io.to(p).emit('gameEnded', {
          winner: pid,
          reason: `ha una combinazione speciale: ${result.combination}`
        });
      });
      winner = true;
    }
  });

  if (!winner) {
    io.to(getCurrentPlayer(room)).emit('yourTurn');
  }
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex];
}

function findPlayerRoom(id) {
  return Object.keys(rooms).find(code => rooms[code].players.includes(id));
}

function calculatePoints(hand) {
  const valueMap = {
    A: 1, J: 11, Q: 12, K: 13
  };
  return hand.reduce((sum, card) => {
    const val = isNaN(card.value) ? valueMap[card.value] || 0 : parseInt(card.value);
    return sum + val;
  }, 0);
}


const PORT = 3001;
server.listen(PORT, () => console.log(`🟢 Server online su porta ${PORT}`));
