const express = require('express');
const http = require('http');
const io = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to mongo server'))
  .catch(() => {
    console.error('Failed to connect to mongo server at: ' + process.env.MONGODB_URI);
    process.exit(1);
  });

const ChatRoom = mongoose.model('ChatRoom', {
  roomId: {
    type: String,
    unique: true
  },
  name: String,
  private: Boolean
});

const ChatMessage = mongoose.model('ChatMessage', {
  roomId: String,
  messageId: {
    type: String,
    unique: true
  },
  message: String,
  from: String
});

const app = express();

// parse application/json
app.use(bodyParser.json());

// allow all computers to access this api
app.use(cors());

/*
 * Create a secure server
 */
const server = http.createServer(app);

const ioServer = io(server);

ioServer.on('connection', (socket) => {
  console.log('a user connected');
  const roomId = socket.handshake.query.roomId;

  socket.join(roomId);
});

/**
 * Endpoint to show the server is working
 */
app.get('/', (req, res) => {
  res.send('snackchat-server');
});

/**
 * Get all rooms
 */
app.get('/rooms', (req, res) => {
  ChatRoom.find({ private: false })
    .then((rooms) => {
      res.json(rooms.map((room) => ({
        roomId: room.roomId,
        name: room.name
      })));
    })
    .catch((err) => {
      res.status(500);
      res.json({
        error: err.message
      });
    });
});

/*
 * Get info about a room
 */
app.get('/rooms/:id', (req, res) => {
 ChatRoom.findOne({ roomId: req.params.id })
   .then((room) => {
     res.json({
       roomId: room.roomId,
       name: room.name
     });
   })
   .catch((err) => {
     res.status(500);
     res.json({
       error: err.message
     });
   });
});

/*
 * Create a new room
 */
app.post('/rooms', (req, res) => {
  const room = new ChatRoom({
    roomId: req.body.roomId,
    name: req.body.name,
    private: req.body.private
  });

  room.save()
    .then(() => res.json('ok'))
    .catch((err) => {
      res.status(500);
      res.json({
        error: err.message
      });
    });
});

/*
 * Get all chat messages
 */
app.get('/rooms/:id/messages', (req, res) => {
  ChatMessage.find({ roomId: req.params.id })
    .then((messages) => {
      res.json(messages.map((message) => ({
        roomId: message.roomId,
        messageId: message.messageId,
        message: message.message,
        from: message.from
      })));
    })
    .catch((err) => {
      res.status(500);
      res.json({
        error: err.message
      });
    });
});

/*
 * Add a chat message
 */
app.post('/rooms/:id/messages', (req, res) => {
  console.log('message recieved');
  ChatRoom.count({ roomId: req.params.id })
    .then((count) => {
      if (count > 0){
        // document exists;
        const message = new ChatMessage({
          roomId: req.params.id,
          messageId: req.body.messageId,
          message: req.body.message,
          from: req.body.from
        });

        return message.save()
          .then(() => {
            console.log('message saved');
            res.json('ok')
            ioServer.to(req.params.id).emit('message', {
              messageId: req.body.messageId,
              message: req.body.message,
              from: req.body.from
            })
          });
      } else {
        res.status(500);
        res.json('Chat room does not exist')
      }
    })
    .catch((err) => {
      res.status(500);
      res.json({
        error: err.message
      });
    });
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(port);
});
