
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { createDeck, shuffle, dealHand, evaluateHand } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 Server listening on port {PORT}`);
});

const games = {};
const players = {};

io.on('connection', (socket) => {
  console.log(`✅ [{socket.id}] connected`);

  socket.on('createGame', (playerName) => {
    const gameId = uuidv4();
    const playerId = socket.id;

    if (!playerName) return;

    games[gameId] = {
      id: gameId,
      players: [{ id: playerId, name: playerName }],
      host: playerId,
      started: false
    };

    players[playerId] = gameId;
    socket.join(gameId);

    console.log(`[{playerId}] ha creato la stanza {gameId} come {playerName}`);
  });

  socket.emit('gameCreated', {
    gameId,
    players: games[gameId].players
  });
  

  socket.on('joinGame', ({ gameId, playerName }) => {
    const playerId = socket.id;
    const game = games[gameId];
    if (!game || game.started || !playerName) return;

    game.players.push({ id: playerId, name: playerName });
    players[playerId] = gameId;
    socket.join(gameId);

    console.log(`[{playerId}] si è unito a {gameId} come {playerName}`);
  });

  socket.on('startGame', () => {
    const playerId = socket.id;
    const gameId = players[playerId];
    const game = games[gameId];

    if (!game || game.host !== playerId || game.started) return;

    const deck = createDeck();
    shuffle(deck);

    game.started = true;
    game.deck = [...deck];

    game.players.forEach((player, index) => {
      const hand = dealHand(game.deck);
      const special = evaluateHand(hand);
      io.to(player.id).emit('initialHand', {
        hand,
        special,
        playerIndex: index,
        totalPlayers: game.players.length,
        allPlayers: game.players.map(p => p.id)
      });
    });

    console.log(`🎲 La partita {gameId} è iniziata con {game.players.length} giocatori`);
  });

  socket.on('disconnect', () => {
    const playerId = socket.id;
    const gameId = players[playerId];
    if (!gameId || !games[gameId]) return;

    games[gameId].players = games[gameId].players.filter(p => p.id !== playerId);
    delete players[playerId];
    console.log(`❌ [{playerId}] disconnesso dalla stanza {gameId}`);
  });
});

  socket.on('joinGame', ({ gameId, playerName }) => {
    const playerId = socket.id;
    const game = games[gameId];
    if (!game || game.started || !playerName) return;

    game.players.push({ id: playerId, name: playerName });
    players[playerId] = gameId;
    socket.join(gameId);

    console.log(`[{playerId}] si è unito a {gameId} come {playerName}`);
  });

  socket.on('startGame', () => {
    const playerId = socket.id;
    const gameId = players[playerId];
    const game = games[gameId];

    if (!game || game.host !== playerId || game.started) return;

    const deck = createDeck();
    shuffle(deck);

    game.started = true;
    game.deck = [...deck];

    game.players.forEach((player, index) => {
      const hand = dealHand(game.deck);
      const special = evaluateHand(hand);
      io.to(player.id).emit('initialHand', {
        hand,
        special,
        playerIndex: index,
        totalPlayers: game.players.length,
        allPlayers: game.players.map(p => p.id)
      });
    });

    console.log(`🎲 La partita {gameId} è iniziata con {game.players.length} giocatori`);
  });

  socket.on('disconnect', () => {
    const playerId = socket.id;
    const gameId = players[playerId];
    if (!gameId || !games[gameId]) return;

    games[gameId].players = games[gameId].players.filter(p => p.id !== playerId);
    delete players[playerId];
    console.log(`❌ [{playerId}] disconnesso dalla stanza {gameId}`);
  });