import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Be more specific in production
    methods: ["GET", "POST"]
  }
});

// Store seat states
let seatStates = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send current seat states to new connections
  socket.emit('initializeSeats', seatStates);

  // Handle seat selection
  socket.on('selectSeat', (seatId) => {
    seatStates[seatId] = {
      status: 'selected',
      userId: socket.id
    };
    // Broadcast to all clients
    io.emit('seatUpdated', { seatId, status: 'selected', userId: socket.id });
  });

  // Handle seat deselection
  socket.on('deselectSeat', (seatId) => {
    delete seatStates[seatId];
    // Broadcast to all clients
    io.emit('seatUpdated', { seatId, status: 'available' });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clear seats selected by disconnected user
    Object.entries(seatStates).forEach(([seatId, state]) => {
      if (state.userId === socket.id) {
        delete seatStates[seatId];
        io.emit('seatUpdated', { seatId, status: 'available' });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
}); 