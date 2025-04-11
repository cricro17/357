const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Configurazione di Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: "https://three57-frontend.onrender.com", // URL del frontend
    methods: ["GET", "POST"], // Metodi permessi
  },
});

// Middleware per CORS
app.use(cors());

// Endpoint di base per il test del backend
app.get("/", (req, res) => {
  res.send("Server di backend attivo!");
});

// Gestione connessioni Socket.IO
io.on("connection", (socket) => {
  console.log("Nuovo client connesso:", socket.id);

  // Eventi personalizzati
  socket.on("message", (data) => {
    console.log("Messaggio ricevuto:", data);
    socket.broadcast.emit("message", data); // Invia il messaggio agli altri client
  });

  socket.on("disconnect", () => {
    console.log("Client disconnesso:", socket.id);
  });
});

// Avvio del server
const PORT = process.env.PORT || 3000; // Porta dinamica o 3000
server.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});