const io = require("socket.io")(3000, {
  cors: {
    origin: ["http://127.0.0.1:5500"],
  },
});

const rooms = new Map();

let onlinePlayers = 0;

let roomPlayers = 0;

let maxPlayers = 15;

const adjectives = [
  "Red",
  "Blue",
  "Dark",
  "Swift",
  "Silent",
  "Fierce",
  "Crazy",
  "Mighty",
  "Rapid",
  "Shadow",
  "Lucky",
  "Iron",
  "Wild",
  "Brave",
  "Golden",
  "Silver",
];

const nouns = [
  "Tiger",
  "Falcon",
  "Wolf",
  "Knight",
  "Wizard",
  "Ninja",
  "Phoenix",
  "Dragon",
  "Ranger",
  "Samurai",
  "Viking",
  "Panther",
  "Eagle",
  "Shark",
];

const colors = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
];

const activeNames = new Set();
const activeColors = new Set();

function generateColor() {
  let color;

  if (activeColors.size < colors.length) {
    do {
      color = colors[Math.floor(Math.random() * colors.length)];
    } while (activeColors.has(color));
  } else {
    color = "#" + Math.floor(Math.random() * 16777215).toString(16);
  }

  activeColors.add(color);
  return color;
}

function generateName() {
  let name;
  do {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    name = `${adj}${noun}${number}`;
  } while (activeNames.has(name));

  activeNames.add(name);
  return name;
}

function startGame(room) {
  const game = rooms.get(room);

  game.phase = "day";

  const players = Array.from(game.players.keys());

  players.sort(() => Math.random() - 0.5);

  const killer = players[0];
  const medic = players[1];

  game.players.get(killer).role = "killer";
  game.players.get(medic).role = "medic";

  for (let i = 2; i < players.length; i++) {
    game.players.get(players[i]).role = "civilian";
  }

  for (let [id, player] of game.players) {
    io.to(id).emit("your-role", player.role);
  }

  startDayTimer(room);
}

function startDayTimer(room) {
  const game = rooms.get(room);

  let timeLeft = 30;

  io.to(room).emit("day-timer", timeLeft);

  const interval = setInterval(() => {
    timeLeft--;
    io.to(room).emit("day-timer", timeLeft);

    if (timeLeft <= 0) {
      clearInterval(interval);
      startNight(room);
    }
  }, 1000);
}

function startNight(room) {
  const game = rooms.get(room);
  game.phase = "night";
  io.to(room).emit(
    "player-list",
    Array.from(game.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      alive: p.alive,
    })),
  );
  let timeLeft = 10;
  io.to(room).emit("night-start", timeLeft);

  const interval = setInterval(() => {
    timeLeft--;
    io.to(room).emit("night-timer", timeLeft);

    if (timeLeft <= 0) {
      clearInterval(interval);
      resolveNight(room);
    }
  }, 1000);
}

function checkWin(room) {
  const game = rooms.get(room);

  const alivePlayers = [...game.players.values()].filter((p) => p.alive);
  const killerAlive = alivePlayers.some((p) => p.role === "killer");

  if (!killerAlive) {
    io.to(room).emit("game-over", "Civilians Win");
    return true;
  }

  if (alivePlayers.length <= 2) {
    io.to(room).emit("game-over", "Killer Wins");
    return true;
  }

  return false;
}

function resolveNight(room) {
    const game = rooms.get(room);

    if (game.killerTarget && game.killerTarget !== game.medicTarget) {
      game.players.get(game.killerTarget).alive = false;
      io.to(room).emit("player-died", game.killerTarget);
    }

    game.killerTarget = null;
    game.medicTarget = null;

    startVoting(room);
  }

io.on("connection", (socket) => {
  // console.log(socket.id);
  const username = generateName();
  const color = generateColor();

  socket.username = username;
  socket.color = color;

  socket.emit("your-identity", {
    name: username,
    color: color,
  });
  // console.log(socket.rooms);
  // console.log(io.sockets.adapter.rooms);
  onlinePlayers++;
  io.emit("onlinePlayers", onlinePlayers);
  socket.on("send-message", ({ text, room }) => {
    // console.log("Sender:", socket.id);
    // console.log("Room sent:", room);
    // console.log("Type:", typeof room);
    if (room === "") {
      io.emit("receive-message", {
        text,
        sender: socket.username,
        color: socket.color,
      });
    } else {
      io.to(room).emit("receive-message", {
        text,
        sender: socket.username,
        color: socket.color,
      });
    }
  });
  socket.on("night-action", (targetId) => {
    const room = socket.currentRoom;
    const game = rooms.get(room);

    if (game.phase !== "night") return;
    if (!game.players.get(socket.id).alive) return;

    const role = game.players.get(socket.id).role;

    if (role === "killer") {
      game.killerTarget = targetId;
    }

    if (role === "medic") {
      game.medicTarget = targetId;
    }
    io.to(room).emit(
      "player-list",
      Array.from(game.players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        alive: p.alive,
      })),
    );
  });

  
  socket.on("vote", (targetId) => {
    const game = rooms.get(socket.currentRoom);

    if (!game.players.get(socket.id).alive) return;

    game.votes.set(targetId, (game.votes.get(targetId) || 0) + 1);
  });
  socket.on("disconnecting", () => {
    onlinePlayers--;
    io.emit("onlinePlayers", onlinePlayers);

    activeNames.delete(socket.username);
    activeColors.delete(socket.color);

    if (socket.currentRoom) {
      const room = socket.currentRoom;

      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;

      const newSize = roomSize - 1;

      const game = rooms.get(room);

      if (game) {
        game.players.delete(socket.id);

        if (game.players.size === 0) {
          rooms.delete(room);
        }
      }

      io.to(room).emit("room-player-count", {
        count: newSize,
        max: maxPlayers,
      });
    }
  });
  socket.on("join-room", (room, cb) => {
    room = room.toString();

    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;

    if (roomSize >= maxPlayers) {
      return cb({ success: false, message: "Room is full" });
    }

    socket.join(room);
    socket.currentRoom = room;

    const updatedSize = roomSize + 1;
    if (!rooms.has(room)) {
      rooms.set(room, {
        players: new Map(),
        phase: "lobby",
        timer: null,
        killerTarget: null,
        medicTarget: null,
        votes: new Map(),
      });
    }

    const game = rooms.get(room);

    game.players.set(socket.id, {
      name: socket.username,
      role: null,
      alive: true,
    });

    io.to(room).emit("room-player-count", {
      count: updatedSize,
      max: maxPlayers,
    });

    cb({ success: true, message: `Joined ${room}` });
  });
  socket.on("start-game", () => {
    const room = socket.currentRoom;
    const game = rooms.get(room);

    if (!game) return;
    if (game.phase !== "lobby") return;

    if (game.players.size < 2) {
      io.to(room).emit("receive-message", {
        text: "Need at least 2 players to start.",
        sender: "System",
        color: "#ffffff",
      });
      return;
    }

    game.phase = "countdown";

    let timeLeft = 10;

    io.to(room).emit("game-countdown", timeLeft);

    const interval = setInterval(() => {
      timeLeft--;

      io.to(room).emit("game-countdown", timeLeft);

      if (timeLeft <= 0) {
        clearInterval(interval);
        startGame(room);
      }
    }, 1000);
  });
  socket.on("change-name", (newName, cb) => {
    newName = newName.trim();

    if (activeNames.has(newName)) {
      return cb({ success: false, message: "Name already taken" });
    }

    activeNames.delete(socket.username);
    activeNames.add(newName);

    socket.username = newName;

    cb({ success: true, name: newName });
  });
});
