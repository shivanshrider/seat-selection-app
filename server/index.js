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
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
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
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Save data periodically (every 5 minutes)
setInterval(saveSeatData, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 