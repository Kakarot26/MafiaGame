const io = require('socket.io')(3000, {
    cors: {
        origin: ['http://127.0.0.1:5500'],
    },
});

let onlinePlayers = 0;

let roomPlayers = 0;

const adjectives = [
  "Red","Blue","Dark","Swift","Silent","Fierce","Crazy","Mighty",
  "Rapid","Shadow","Lucky","Iron","Wild","Brave","Golden","Silver"
];

const nouns = [
  "Tiger","Falcon","Wolf","Knight","Wizard","Ninja","Phoenix",
  "Dragon","Ranger","Samurai","Viking","Panther","Eagle","Shark"
];

const colors = [
  "#e6194b","#3cb44b","#ffe119","#4363d8",
  "#f58231","#911eb4","#46f0f0","#f032e6",
  "#bcf60c","#fabebe","#008080","#e6beff"
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
        color = "#" + Math.floor(Math.random()*16777215).toString(16);
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

io.on('connection', socket => {
    // console.log(socket.id);
    const username = generateName();
    const color = generateColor();

    socket.username = username;
    socket.color = color;

    socket.emit('your-identity', {
        name:username,
        color: color
    });
    // console.log(socket.rooms);
    // console.log(io.sockets.adapter.rooms);
    onlinePlayers++;
    io.emit("onlinePlayers", onlinePlayers);
    socket.on('send-message', ({text, room}) => {
        // console.log("Sender:", socket.id);
        // console.log("Room sent:", room);
        // console.log("Type:", typeof room);
        if(room === ''){
            io.emit('receive-message', {text, sender:socket.username, color:socket.color});
        }
        else {
            io.to(room).emit('receive-message', {text, sender:socket.username, color:socket.color});
        }
    })
    socket.on("disconnect", ()=> {
        onlinePlayers--;
        io.emit("onlinePlayers", onlinePlayers)
        activeNames.delete(socket.username);
        activeColors.delete(socket.color);
    })
    socket.on('join-room', (room, cb) => {
        room = room.toString();
        socket.join(room);
        cb(`Joined ${room}`);
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

