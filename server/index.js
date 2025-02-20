import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",  // Allow all origins temporarily for testing
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Add a health check endpoint
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Persistent storage for seats
let seatStates = new Map();

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
    return new Map();
  } catch (error) {
    console.error('Error loading seat data:', error);
    return new Map();
  }
};

// Load saved data on server start
seatStates = loadSeatData();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
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

  socket.on('selectSeat', (seatId) => {
    const seatData = seatStates.get(seatId);

    // Check if seat is already taken by another user
    if (seatData && seatData.userId !== socket.id) {
      return; // Silently fail instead of sending error
    }

    // Update seat state
    seatStates.set(seatId, {
      status: 'selected',
      userId: socket.id
    });

    // Save the updated state
    saveSeatData();

    // Broadcast update to all clients
    io.emit('seatUpdated', {
      seatId,
      status: 'selected',
      userId: socket.id
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
    }
  });
});

// Save data periodically (every 5 minutes)
setInterval(saveSeatData, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 