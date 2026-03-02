const socket = io("http://localhost:3000");

const createRoomButton = document.querySelector(".createRoom");
const joinRoomButton = document.querySelector(".joinRoom");
const backButton = document.querySelector(".backButton");
const roomCodeDiv = document.querySelector(".roomCode");
const joinRoomCode = document.querySelector(".joinRoomCode");
const startGameButton = document.querySelector(".startGame");
const joinRoomSend = document.querySelector(".send");
const changeName = document.querySelector(".changeName");
const renameButton = document.querySelector(".renameButton");
const renameInput = document.querySelector(".renameInput");

let currentRoom = "";
let currentName = "";

socket.on("room-player-count", ({ count, max }) => {
  const el = document.getElementById("room-count");
  if (el) {
    el.textContent = `Players: ${count}/${max}`;
  }
});

socket.on("onlinePlayers", (count) => {
  document.getElementById("online-count").textContent =
    `Online(Global): ${count}`;
});

socket.on("connect", () => {
  displayMessage(`You connected with id ${socket.id}`, `Server`);
});

socket.on("receive-message", ({ text, sender, color }) => {
  currentName = sender;
  displayMessage(text, sender, color);
});

function showRoom(code, mode) {
  if (mode === "create") {
    roomCodeDiv.textContent = code;
    startGameButton.style.display = "inline-block";
  } else {
    joinRoomCode.style.display = "inline-block";
    joinRoomCode.placeholder = code;
    joinRoomSend.style.display = "inline-block";
  }
  createRoomButton.style.display = "none";
  joinRoomButton.style.display = "none";
  changeName.style.display = "none";

  backButton.style.display = "inline-block";
}

createRoomButton.addEventListener("click", () => {
  const code = Math.floor(Math.random() * 10000).toString();
  currentRoom = code + "";
  socket.emit("join-room", code, (response) => {
    if (!response.success) {
      displayMessage(response.message, "System");
      return;
    }

    displayMessage(response.message, "System");
  });
  showRoom("Your room code: " + code, "create");
});

joinRoomButton.addEventListener("click", () => {
  showRoom("Enter Room Code to Join", "join");
});

joinRoomSend.addEventListener("click", () => {
  const room = joinRoomCode.value.trim();
  currentRoom = room;
  socket.emit("join-room", room, (response) => {
    if (!response.success) {
      displayMessage(response.message, "System");
      return;
    }

    displayMessage(response.message, "System");
  });
});

startGameButton.addEventListener("click", () => {
  socket.emit("start-game");
});

socket.on("game-countdown", (time) => {
  document.getElementById("timer-display").textContent =
    `Game starting in ${time}`;
});

socket.on("your-role", (role) => {
  // hide lobby stuff
  createRoomButton.style.display = "none";
  joinRoomButton.style.display = "none";
  changeName.style.display = "none";
  backButton.style.display = "none";
  startGameButton.style.display = "none";
  roomCodeDiv.style.display = "none";
  joinRoomCode.style.display = "none";
  joinRoomSend.style.display = "none";

  document.getElementById("role-display").textContent =
    `Your Role: ${role.toUpperCase()}`;
});

socket.on("day-timer", (time) => {
  document.getElementById("game-overlay").style.display = "none";
  document.getElementById("timer-display").textContent =
    `Day: ${time}s remaining`;
});

socket.on("night-start", (time) => {
  const overlay = document.getElementById("game-overlay");

  overlay.style.display = "block";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.pointerEvents = "none";

  document.getElementById("timer-display").textContent =
    `Night: ${time}s`;
});

socket.on("night-timer", (time) => {
  document.getElementById("timer-display").textContent =
    `Night: ${time}s`;
});

socket.on("player-list", (players) => {
  const list = document.getElementById("player-list");
  list.innerHTML = "";

  players.forEach(p => {
    if (!p.alive) return;

    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.dataset.id = p.id;
    btn.onclick = () => {
      socket.emit("night-action", p.id);
    };

    list.appendChild(btn);
  });
});

socket.on("player-died", (id) => {
  const list = document.getElementById("player-list");
  [...list.children].forEach(btn => {
    if (btn.dataset.id === id) {
      btn.style.opacity = 0.4;
      btn.disabled = true;
    }
  });
});

backButton.addEventListener("click", () => {
  createRoomButton.style.display = "inline-block";
  joinRoomButton.style.display = "inline-block";
  changeName.style.display = "inline-block";
  roomCodeDiv.textContent = "";
  backButton.style.display = "none";
  joinRoomCode.style.display = "none";
  startGameButton.style.display = "none";
  joinRoomSend.style.display = "none";
  renameButton.style.display = "none";
  renameInput.style.display = "none";
  currentRoom = "";
    displayMessage(`${currentName} Left the room`);
});

changeName.addEventListener("click", () => {
  createRoomButton.style.display = "none";
  joinRoomButton.style.display = "none";
  changeName.style.display = "none";
  renameButton.style.display = "inline-block";
  renameInput.style.display = "inline-block";
  backButton.style.display = "inline-block";
});

renameButton.addEventListener("click", () => {
  const newName = renameInput.value.trim();
  if (!newName) return;
  currentName = newName;
  socket.emit("change-name", newName, (response) => {
    if (!response.success) {
      displayMessage(response.message, "System");
      return;
    }

    displayMessage(`You are now ${response.name}`, "System");
    renameInput.value = "";
  });
});

document.addEventListener("keydown", function (event) {
  if (event.key === "/") {
    event.preventDefault();
    const chatInput = document.querySelector(".chat-area input");
    chatInput.value = "";
    if (chatInput) {
      chatInput.focus();
    }
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const input = document.querySelector(".chat-area input");
    if (input.value === "") return;
    // displayMessage(input.value, `You`);
    socket.emit("send-message", {
      text: input.value,
      room: currentRoom,
      sender: socket.id,
    });
    input.value = "";
  }
});

function displayMessage(message, sender, color) {
  let name = sender || "Anon";
  const chatBox = document.querySelector(".chat-area .messages");
  const newChat = document.createElement("div");
  newChat.classList.add("chat-message");

  newChat.innerHTML = `<span style="color:${color}; font-weight:bold">${name}</span>: ${message}`;

  chatBox.appendChild(newChat);
  chatBox.scrollTop = chatBox.scrollHeight;
}
