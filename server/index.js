import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

// More permissive CORS configuration
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",  // Allow all origins temporarily
    methods: ["GET", "POST"],
    credentials: false,  // Changed to false
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Persistent storage for seats
let seatStates = new Map();

// Save seat data
const saveSeatData = () => {
  // Implementation for saving seat data
  console.log('Saving seat data...');
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current seat states to new client
  for (const [seatId, data] of seatStates.entries()) {
    socket.emit('seatUpdated', {
      seatId,
      status: 'selected',
      userId: data.userId
    });
  }

  socket.on('selectSeat', (seatId) => {
    const seatData = seatStates.get(seatId);
    
    if (seatData) {
      socket.emit('seatError', { 
        seatId, 
        message: 'Seat already taken' 
      });
      return;
    }

    // Store the selection
    seatStates.set(seatId, {
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
    } else {
      socket.emit('seatError', { 
        seatId, 
        message: 'You can only deselect your own seats' 
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Save data periodically (every 5 minutes)
setInterval(saveSeatData, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 