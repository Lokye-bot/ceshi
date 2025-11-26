const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT || 3001);
const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH || 1000);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((item) => item.trim())
  : '*';

const app = express();
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

const db = new Database(path.join(__dirname, 'chat.db'));
db.pragma('journal_mode = WAL');

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS participants (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  )
`,
).run();

const insertConversation = db.prepare(
  `INSERT OR IGNORE INTO conversations (id, created_at) VALUES (?, ?)`,
);
const insertParticipant = db.prepare(
  `INSERT OR IGNORE INTO participants (conversation_id, user_id, joined_at) VALUES (?, ?, ?)`,
);
const insertMessage = db.prepare(
  `INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
);
const fetchMessages = db.prepare(
  `SELECT id, conversation_id AS roomId, sender_id AS senderId, content, created_at AS createdAt
   FROM messages
   WHERE conversation_id = ?
     AND created_at < ?
   ORDER BY created_at DESC
   LIMIT ?`,
);
const fetchRecentMessages = db.prepare(
  `SELECT id, conversation_id AS roomId, sender_id AS senderId, content, created_at AS createdAt
   FROM messages
   WHERE conversation_id = ?
   ORDER BY created_at DESC
   LIMIT ?`,
);
const fetchUserRooms = db.prepare(
  `SELECT c.id AS roomId,
          MAX(m.created_at) AS lastMessageAt,
          COUNT(m.id) AS messageCount
   FROM conversations c
   JOIN participants p ON p.conversation_id = c.id
   LEFT JOIN messages m ON m.conversation_id = c.id
   WHERE p.user_id = ?
   GROUP BY c.id
   ORDER BY lastMessageAt DESC`,
);
const fetchParticipants = db.prepare(
  `SELECT user_id AS userId, joined_at AS joinedAt
   FROM participants
   WHERE conversation_id = ?
   ORDER BY joined_at ASC`,
);

function ensureConversation(roomId) {
  insertConversation.run(roomId, Date.now());
}

function ensureParticipant(roomId, userId) {
  insertParticipant.run(roomId, userId, Date.now());
}

function normalizeLimit(value, fallback = 50) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const limit = normalizeLimit(req.query.limit);
  const before = req.query.before ? Number(req.query.before) : null;

  ensureConversation(roomId);
  const rows = before
    ? fetchMessages.all(roomId, before, limit)
    : fetchRecentMessages.all(roomId, limit);

  res.json({
    roomId,
    messages: rows.reverse(),
  });
});

app.get('/api/rooms/:roomId/participants', (req, res) => {
  const { roomId } = req.params;
  ensureConversation(roomId);
  const rows = fetchParticipants.all(roomId);
  res.json({ roomId, participants: rows });
});

app.get('/api/users/:userId/rooms', (req, res) => {
  const { userId } = req.params;
  const rooms = fetchUserRooms.all(userId);
  const result = rooms.map((room) => ({
    ...room,
    participants: fetchParticipants.all(room.roomId),
  }));
  res.json({ userId, rooms: result });
});

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, userId }) => {
    if (!roomId || !userId) return;
    ensureConversation(roomId);
    ensureParticipant(roomId, userId);

    socket.join(roomId);
    socket.emit('joined', { roomId });
    socket.to(roomId).emit('system', {
      type: 'join',
      roomId,
      userId,
      at: Date.now(),
    });
  });

  socket.on('leave', ({ roomId, userId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit('system', {
      type: 'leave',
      roomId,
      userId,
      at: Date.now(),
    });
  });

  socket.on('message', ({ roomId, senderId, content }) => {
    if (!roomId || !senderId || typeof content !== 'string') return;

    const trimmed = content.trim();
    if (!trimmed) return;
    const clipped = trimmed.slice(0, MAX_MESSAGE_LENGTH);

    ensureConversation(roomId);
    ensureParticipant(roomId, senderId);

    const message = {
      id: randomUUID(),
      roomId,
      senderId,
      content: clipped,
      createdAt: Date.now(),
    };

    insertMessage.run(
      message.id,
      message.roomId,
      message.senderId,
      message.content,
      message.createdAt,
    );

    io.to(roomId).emit('message', message);
  });

  socket.on('disconnecting', () => {
    // sockets auto-leave their rooms; nothing else required now
  });
});

server.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});

