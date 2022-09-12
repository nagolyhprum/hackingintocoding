// set up http server
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
app.get("/", (_, res) => {
    res.header("Content-Type", "text/html");
    res.send(ClientHTML);
});
app.get("/index.css", (_, res) => {
    res.header("Content-Type", "text/css");
    res.send(ClientCSS);
});
app.get("/index.js", (_, res) => {
    res.header("Content-Type", "text/javascript");
    res.send(ClientJS);
});
server.listen(80, () => console.log("ready"));

// set up server side sockets
const socket = require("socket.io");
const { Server } = socket;
const io = new Server(server);

// set up server side video
const { createCanvas } = require("canvas");
const SQUARE_SIZE = 10;
const WIDTH = 300;
const HEIGHT = 150;
const canvas = createCanvas(WIDTH, HEIGHT);
const context = canvas.getContext("2d");

// set up server side audio
const audioLoader = require("audio-loader");
const beeper = new Promise((resolve, reject) => {
    audioLoader("./beeper.wav", (err, data) => {
        if(err) reject(err);
        else resolve(data);
    })
});

const ClientHTML = `
<!doctype html>
<html>
    <head>
        <link href="./index.css" rel="stylesheet" />
    </head>
    <body>
        <canvas width="${WIDTH}" height="${HEIGHT}"></canvas>
        <script defer src="/socket.io/socket.io.js"></script>
        <script defer src="./index.js"></script>
    </body>
</html>
`;

const ClientCSS = `
canvas {
    background : black;
}
body {
    margin : 0;
}
`;

const ClientJS = `
// set up client side canvas
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

// set up client side sockets
const socket = io();

socket.on("video", event => {
    // use rgba data as 8 bit numbers
    const data = new Uint8Array(event.data);
    // copy the server's canvas to the browser's canvas
    const id = context.getImageData(event.x, event.y, event.width, event.height);
    for(let i = 0; i < id.data.length; i++) {
        id.data[i] = data[i];
    }
    context.putImageData(id, 0, 0);
});

canvas.onmousemove = event => {
    socket.emit("mousemove", {
        x : event.pageX,
        y : event.pageY
    });
};

document.body.onclick = () => {
    document.body.onclick = null;
    const audioContext = new AudioContext();
    socket.on("audio", event => {
        const myArrayBuffer = audioContext.createBuffer(event.numberOfChannels, event.length, event.sampleRate);
        for(let channel = 0; channel < event.numberOfChannels; channel++) {
            const nowBuffering = myArrayBuffer.getChannelData(channel);
            // use audio data as 32 bit numbers
            const data = new Int32Array(event.channelData[channel]);
            // copy the server's audio stream to the browser's audio stream
            for (let i = 0; i < myArrayBuffer.length; i++) {
                nowBuffering[i] = data[i];
            }
        }  
        const source = audioContext.createBufferSource();
        source.buffer = myArrayBuffer;
        source.connect(audioContext.destination);
        source.start();
    });
};
`;

io.on("connection", socket => {
    // the mouse starts at the middle of the screen
    const mouse = {
        x : canvas.width / 2,
        y : canvas.height / 2
    };
    // start with a random velocity direction
    const theta = random(0, 360) / 180 * Math.PI;
    // a bouncing cube
    const square = {
        size : {
            width : SQUARE_SIZE,
            height : SQUARE_SIZE
        },
        location : {
            x : random(0, canvas.width - SQUARE_SIZE),
            y : random(0, canvas.height - SQUARE_SIZE)
        },
        color : "red",
        velocity : {
            x : 100 * Math.cos(theta),
            y : 100 * Math.sin(theta),
        }
    };
    // keep track of time between updates
    let lastUpdate = Date.now();
    const video = setInterval(() => {
        const now = Date.now();
        const diff = (now - lastUpdate) / 1000;
        lastUpdate = now;
        // handle video
        draw(canvas, square, mouse, diff);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        socket.emit("video", {
            x : 0,
            y : 0,
            width : canvas.width,
            height : canvas.height,
            data
        });        
        // update (also handles audio)
        update(socket, square, diff);
    }, 1000 / 60);
    socket.on("disconnect", () => {
        clearInterval(video);
    });
    socket.on("mousemove", event => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
});

const random = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

const draw = (canvas, square, mouse, diff) => {
    // clear
    context.clearRect(0, 0, canvas.width, canvas.height);
    // rect
    context.fillStyle = square.color;
    context.fillRect(square.location.x, square.location.y, square.size.width, square.size.height);
    // fps
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillStyle = "red";
    context.fillText(Math.floor(1 / diff), canvas.width - 10, canvas.height - 10);
    // mouse
    context.fillStyle = "green";
    context.fillRect(mouse.x - 5, mouse.y - 5, 10, 10);
};

const bounce = socket => {
    beeper.then(data => {
        socket.emit("audio", {
            id : "bounce",
            length : data.length,
            numberOfChannels : data.numberOfChannels,
            sampleRate : data.sampleRate,
            duration : data.duration,
            channelData : data._channelData
        });
    });
};

const update = (socket, square, diff) => {
    // move the square around
    square.location.x = square.location.x + square.velocity.x * diff;
    square.location.y = square.location.y + square.velocity.y * diff;
    // bounce the square and make a sound
    if(square.location.x <= 0 && square.velocity.x < 0) {
        square.velocity.x = -square.velocity.x;
        bounce(socket);
    }
    if(square.location.y <= 0 && square.velocity.y < 0) {
        square.velocity.y = -square.velocity.y;
        bounce(socket);
    }
    if(square.location.x + square.size.width >= canvas.width  && square.velocity.x > 0) {
        square.velocity.x = -square.velocity.x;
        bounce(socket);
    }
    if(square.location.y + square.size.height >= canvas.height  && square.velocity.y > 0) {
        square.velocity.y = -square.velocity.y;
        bounce(socket);
    } 
};