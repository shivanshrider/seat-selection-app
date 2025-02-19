import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);

// Configure Socket.IO with proper CORS
const io = new Server(server, {
  cors: {
    origin: ["https://polite-valkyrie-690a58.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxHttpBufferSize: 1e8
});

// Persistent storage for seats
let seatStates = new Map();
const LOCK_TIMEOUT = 60000; // 1 minute in milliseconds

// Save seat data periodically
const saveSeatData = () => {
  const seatData = Array.from(seatStates.entries());
  // You could also save this to a database
  console.log('Seat data saved:', seatData);
};

// Load initial seat data
const loadSeatData = () => {
  try {
    // You could load from a database here
    return new Map(seatData);
  } catch (error) {
    console.error('Error loading seat data:', error);
    return new Map();
  }
};

// Load saved data on server start
seatStates = loadSeatData();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, 20000);

  socket.on('pong', () => {
    console.log('Heartbeat received from:', socket.id);
  });

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
    console.log('Client disconnected:', socket.id);
    // Clear only this user's seats
    for (const [seatId, data] of seatStates.entries()) {
      if (data.userId === socket.id) {
        seatStates.delete(seatId);
        io.emit('seatUpdated', {
          seatId,
          status: 'available'
        });
      }
    }
  });

  // Send current state to new client
  socket.emit('initializeSeats', Array.from(seatStates.entries()).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {}));

  // Broadcast when someone is viewing a seat
  socket.on('viewingSeat', (seatId) => {
    socket.broadcast.emit('seatBeingViewed', { seatId, userId: socket.id });
  });

  socket.on('selectSeat', (seatId) => {
    const now = Date.now();
    const seatData = seatStates.get(seatId);

    // Check if seat is already taken by another user
    if (seatData && seatData.userId !== socket.id) {
      socket.emit('seatError', { 
        seatId, 
        message: 'This seat is already selected by another user' 
      });
      return;
    }

    // Update seat state
    seatStates.set(seatId, {
      status: 'selected',
      userId: socket.id,
      timestamp: now
    });

    // Save the updated state
    saveSeatData();

    // Broadcast update to all clients
    io.emit('seatUpdated', {
      seatId,
      status: 'selected',
      userId: socket.id,
      timestamp: now
    });
  });

  socket.on('deselectSeat', (seatId) => {
    const seatData = seatStates.get(seatId);
    
    // Only allow deselection by the user who selected it
    if (seatData && seatData.userId === socket.id) {
      seatStates.delete(seatId);
      
      // Save the updated state
      saveSeatData();

      io.emit('seatUpdated', {
        seatId,
        status: 'available'
      });
    } else {
      socket.emit('seatError', { 
        seatId, 
        message: 'You can only deselect your own seats' 
      });
    }
  });
});

// Save data periodically (every 5 minutes)
setInterval(saveSeatData, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 