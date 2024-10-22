const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

// Initialize express and create HTTP server
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;
// const userFlowPath = path.join('G:', 'Projects', 'Naradly');//use with pendrive

const userFlowPath = path.join('C:','Users','Lucifer','Desktop', 'Naradly');

// Use the absolute path for serving static files
app.use(express.static(userFlowPath));

// Serve the index.html file from the absolute path
app.get('/', (req, res) => {
    res.sendFile(path.join(userFlowPath, 'index.html'));
});

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'naradly'
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the Database:', err);
        return;
    }
    console.log('Database Connected..');
});

// Function to generate a unique 7-character ID
function generateUniqueId() {
    return uuidv4().replace(/-/g, '').substring(0, 7); // Remove dashes and take the first 7 characters
}

// Room creation endpoint
app.post('/createRoom', (req, res) => {
    const { roomName, hostUsername } = req.body;

    if (!roomName || !hostUsername) {
        return res.status(400).json({ error: 'Room name and host username are required' });
    }

    const uniqueId = generateUniqueId(); // Generate unique room ID

    const query = 'INSERT INTO rooms (room_name, host_username, room_id) VALUES (?, ?, ?)';

    db.query(query, [roomName, hostUsername, uniqueId], (error, results) => {
        if (error) {
            console.error('Database Error:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ message: 'Room created!', roomId: uniqueId });
    });
});

// Join room endpoint
app.post('/joinRoom', (req, res) => {
    const { roomId, username } = req.body;

    console.log('Join Room Request:', { roomId, username }); // Log the received roomId and username

    const query = 'SELECT * FROM rooms WHERE room_id = ?';
    db.query(query, [roomId], (error, results) => {
        if (error) {
            console.error('Database Error:', error);
            return res.status(500).json({ error: error.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Room exists, allow the user to join
        res.json({ message: 'Room joined successfully', roomId: roomId, username: username });
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New WebSocket connection');

    // Listen for joinRoom event
    socket.on('joinRoom', ({ roomId, username }) => {
        if (!username) {
            console.error('Username is undefined');
           
            return; // Prevent proceeding if the username is not valid
        }
        socket.join(roomId);
        console.log(`${username} joined room: ${roomId}`);

        // Send a welcome message to the user
        socket.emit('message', `Welcome to room ${roomId}, ${username}!`);

        // Broadcast to others in the room when a user connects
        socket.broadcast.to(roomId).emit('message', `${username} has joined the room`);

        // Listen for chat messages and broadcast to the room
        socket.on('chatMessage', (message) => {
            io.to(roomId).emit('message', `${username}: ${message}`);
        });

        // Handle user disconnect
        socket.on('disconnect', () => {
            io.to(roomId).emit('message', `${username} has left the room`);
        });
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
