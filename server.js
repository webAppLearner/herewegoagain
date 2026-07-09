require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://jumkhlil_db_user:jumaahklx758274@cluster0.yzk2tsj.mongodb.net/secureChat?appName=Cluster0";

mongoose.connect(MONGO_URI).then(() => {
    console.log("DB Connected");
}).catch(err => console.log(err));

const messageSchema = new mongoose.Schema({
    token: String,
    msg: String,
    createdAt: { type: Date, default: Date.now, expires: 172800 }
});
const Message = mongoose.model('Message', messageSchema);

let tasks = [];
const activeTokens = new Set();

app.post('/api/input', async (req, res) => {
    try {
        const { input } = req.body;
        const secretHash = process.env.SECRET_HASH || await bcrypt.hash("12345", 10);
        const isPassword = await bcrypt.compare(input, secretHash);

        if (isPassword) {
            const token = crypto.randomBytes(32).toString('hex');
            activeTokens.add(token);
            setTimeout(() => activeTokens.delete(token), 3600000);
            return res.json({ action: 'CHAT_ACCESS', token });
        } else {
            const taskId = Date.now();
            const newTask = { id: taskId, task: input };
            tasks.push(newTask);
            return res.json({ action: 'TASK_ADDED', id: taskId, task: input });
        }
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    tasks = tasks.filter(t => t.id.toString() !== taskId.toString());
    res.json({ success: true });
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (activeTokens.has(token)) {
        socket.userToken = token;
        next();
    } else {
        next(new Error("Unauthorized"));
    }
});

io.on('connection', async (socket) => {
    try {
        const rows = await Message.find().sort({ createdAt: -1 }).limit(10);
        const sortedRows = rows.reverse();
        
        if (sortedRows.length > 0) {
            const history = sortedRows.map(r => ({
                msg: r.msg,
                type: r.token === socket.userToken ? 'sent' : 'received'
            }));
            socket.emit('chatHistory', history);
        }
    } catch (error) {
        console.log(error);
    }

socket.on('sendMessage', async (msg) => {
        socket.broadcast.emit('receiveMessage', msg);
        try {
            await Message.create({ token: socket.userToken, msg });
        } catch (error) {
            console.log(error);
        }
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on ${PORT}`));
