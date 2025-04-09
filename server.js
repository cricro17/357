require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Struttura dati per memorizzare le partite
const games = new Map();
const players = new Map();

// Classe per gestire una partita
class Game {
  constructor(id, hostId) {
    this.id = id;
    this.hostId = hostId;
    this.players = new Map();
    this.deck = [];
    this.currentTurn = null;
    this.status = 'waiting'; // waiting, playing, finished
    this.maxPlayers = 4;
  }

  addPlayer(playerId, playerName) {
    if (this.players.size >= this.maxPlayers) return false;
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      hand: [],
      discardPile: []
    });
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.players.size === 0) {
      games.delete(this.id);
    }
  }

  startGame() {
    if (this.players.size < 2) return false;
    this.status = 'playing';
    this.initializeDeck();
    this.dealCards();
    this.currentTurn = Array.from(this.players.keys())[0];
    return true;
  }

  initializeDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.deck = [];
    
    for (let suit of suits) {
      for (let value of values) {
        this.deck.push({
          suit,
          value,
          isRed: suit === '♥' || suit === '♦'
        });
      }
    }
    
    // Shuffle deck
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  dealCards() {
    for (let player of this.players.values()) {
      player.hand = this.deck.splice(0, 5);
    }
  }

  drawCard(playerId) {
    if (this.currentTurn !== playerId) return false;
    if (this.deck.length === 0) return false;
    
    const player = this.players.get(playerId);
    const card = this.deck.pop();
    player.hand.push(card);
    
    this.nextTurn();
    return true;
  }

  discardCard(playerId, cardIndex) {
    if (this.currentTurn !== playerId) return false;
    
    const player = this.players.get(playerId);
    if (cardIndex < 0 || cardIndex >= player.hand.length) return false;
    
    const card = player.hand.splice(cardIndex, 1)[0];
    player.discardPile.push(card);
    
    this.nextTurn();
    return true;
  }

  nextTurn() {
    const playerIds = Array.from(this.players.keys());
    const currentIndex = playerIds.indexOf(this.currentTurn);
    this.currentTurn = playerIds[(currentIndex + 1) % playerIds.length];
  }
}

// Gestione delle connessioni Socket.IO
io.on('connection', (socket) => {
  console.log('Nuovo client connesso:', socket.id);

  // Creazione di una nuova partita
  socket.on('createGame', (playerName) => {
    const gameId = uuidv4();
    const game = new Game(gameId, socket.id);
    game.addPlayer(socket.id, playerName);
    games.set(gameId, game);
    players.set(socket.id, { gameId, playerName });
    
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, players: Array.from(game.players.values()) });
  });

  // Unirsi a una partita esistente
  socket.on('joinGame', ({ gameId, playerName }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Partita non trovata');
      return;
    }

    if (game.addPlayer(socket.id, playerName)) {
      players.set(socket.id, { gameId, playerName });
      socket.join(gameId);
      io.to(gameId).emit('playerJoined', {
        players: Array.from(game.players.values())
      });
    } else {
      socket.emit('error', 'Partita piena');
    }
  });

  // Avviare la partita
  socket.on('startGame', () => {
    const player = players.get(socket.id);
    if (!player) return;

    const game = games.get(player.gameId);
    if (game.hostId !== socket.id) {
      socket.emit('error', 'Solo l\'host può avviare la partita');
      return;
    }

    if (game.startGame()) {
      io.to(player.gameId).emit('gameStarted', {
        players: Array.from(game.players.values()),
        currentTurn: game.currentTurn
      });
    } else {
      socket.emit('error', 'Non ci sono abbastanza giocatori');
    }
  });

  // Pescare una carta
  socket.on('drawCard', () => {
    const player = players.get(socket.id);
    if (!player) return;

    const game = games.get(player.gameId);
    if (game.drawCard(socket.id)) {
      io.to(player.gameId).emit('cardDrawn', {
        playerId: socket.id,
        currentTurn: game.currentTurn
      });
    }
  });

  // Scartare una carta
  socket.on('discardCard', (cardIndex) => {
    const player = players.get(socket.id);
    if (!player) return;

    const game = games.get(player.gameId);
    if (game.discardCard(socket.id, cardIndex)) {
      io.to(player.gameId).emit('cardDiscarded', {
        playerId: socket.id,
        cardIndex,
        currentTurn: game.currentTurn
      });
    }
  });

  // Inviare un messaggio nella chat
  socket.on('chatMessage', (message) => {
    const player = players.get(socket.id);
    if (!player) return;

    io.to(player.gameId).emit('chatMessage', {
      playerId: socket.id,
      playerName: player.playerName,
      message
    });
  });

  // Gestione della disconnessione
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const game = games.get(player.gameId);
      if (game) {
        game.removePlayer(socket.id);
        io.to(player.gameId).emit('playerLeft', {
          playerId: socket.id,
          players: Array.from(game.players.values())
        });
      }
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
}); 