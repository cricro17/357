// ✅ index.js - Nuovo backend Pai Kang
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

const rooms = {}; // roomId => { players: [{ id, name }], started: bool, hands: {}, specials: {} }

io.on('connection', (socket) => {
  console.log('🔌 Nuova connessione:', socket.id);

  socket.on('createGame', (playerName, callback) => {
    const roomId = uuidv4().slice(0, 6);
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName }],
      started: false,
      hands: {},
      specials: {}
    };
    socket.join(roomId);
    callback?.({ roomId });
    console.log(`🎲 Stanza creata: ${roomId} da ${playerName}`);
  });

  socket.on('joinGame', ({ gameId, playerName }) => {
    const room = rooms[gameId];
    if (!room || room.started || room.players.find(p => p.id === socket.id)) return;
    room.players.push({ id: socket.id, name: playerName });
    socket.join(gameId);
    io.to(gameId).emit('playerJoined', { players: room.players });
    console.log(`🙋 ${playerName} si unisce a ${gameId}`);
  });

  socket.on('startGame', () => {
    const roomId = findRoomByPlayer(socket.id);
    if (!roomId) return;
    const room = rooms[roomId];
    if (room.started) return;

    const deck = createDeck();
    const dealt = dealHands(deck, room.players.map(p => p.id));
    const specials = {};

    for (const player of room.players) {
      const hand = dealt[player.id];
      const special = evaluateHand(hand);
      room.hands[player.id] = hand;
      if (special) specials[player.id] = special;
    }

    room.started = true;
    room.specials = specials;

    for (const player of room.players) {
      io.to(player.id).emit('initialHand', {
        hand: room.hands[player.id],
        special: specials[player.id] || null,
        playerIndex: room.players.findIndex(p => p.id === player.id),
        totalPlayers: room.players.length,
        allPlayers: room.players.map(p => p.id)
      });
    }
  });

  socket.on('disconnect', () => {
    const roomId = findRoomByPlayer(socket.id);
    if (!roomId) return;
    const room = rooms[roomId];
    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(roomId).emit('playerLeft', { playerId: socket.id, players: room.players });
    if (room.players.length === 0) delete rooms[roomId];
  });
});

function findRoomByPlayer(socketId) {
  return Object.entries(rooms).find(([_, room]) => room.players.some(p => p.id === socketId))?.[0];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server Pai Kang attivo sulla porta ${PORT}`));
