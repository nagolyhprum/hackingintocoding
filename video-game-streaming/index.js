const express = require("express");
const { createCanvas } = require("canvas");
const socket = require("socket.io");
const http = require('http');
const load = require("audio-loader");
const path = require("path");

const beeper = new Promise((resolve, reject) => {
    load(path.join(__dirname, "beeper.wav"), (err, data) => {
        if(err) reject(err);
        else resolve(data);
    })
});

const SQUARE_SIZE = 10;

const canvas = createCanvas(300, 150);
const context = canvas.getContext("2d");

const app = express();
const server = http.createServer(app);
const { Server } = socket;
const io = new Server(server);

app.get("/", (_, res) => {
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html>
<html>
    <head>
        <link href="./index.css" rel="stylesheet" />
    </head>
    <body>
        <canvas></canvas>
        <script defer src="/socket.io/socket.io.js"></script>
        <script defer src="./index.js"></script>
    </body>
</html>`);
});
app.get("/index.css", (_, res) => {
    res.header("Content-Type", "text/css");
    res.send(`canvas {
    background : black;
}
html, body {
    padding : 0;
    margin : 0;
    border : 0;
}`);
});
app.get("/index.js", (_, res) => {
    res.header("Content-Type", "application/javascript");
    res.send(`const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const socket = io();
socket.on('video', (event) => {
    const data = new Uint8Array(event.data);
    const id = context.getImageData(event.x, event.y, event.width, event.height);
    for(let i = 0; i < id.data.length; i++) {
        id.data[i] = data[i];
    }
    context.putImageData(id, 0, 0);
});

canvas.onmousemove = (event) => {
    socket.emit("mousemove", {
        x : event.pageX,
        y : event.pageY
    });
};

document.body.onclick = () => {
    document.body.onclick = null;
    var audioContext = new AudioContext();
    socket.on('audio', event => {
        const myArrayBuffer = audioContext.createBuffer(event.numberOfChannels, event.length, event.sampleRate);
        for(let channel = 0; channel < event.numberOfChannels; channel++) {
            const nowBuffering = myArrayBuffer.getChannelData(channel);
            const data = new Int32Array(event.channelData[channel]);
            for (let i = 0; i < myArrayBuffer.length; i++) {
                nowBuffering[i] = data[i];
            }
        }  
        const source = audioContext.createBufferSource();
        source.buffer = myArrayBuffer;
        source.connect(audioContext.destination);
        source.start();
    });
};`);
});

const random = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

io.on('connection', (socket) => {
    const mouse = {
        x : canvas.width / 2,
        y : canvas.height / 2
    };
    const bounce = () => {
        beeper.then(data => {
            socket.emit("audio", {
                id : "bounce",
                length : data.length,
                numberOfChannels : data.numberOfChannels,
                sampleRate : data.sampleRate,
                duration : data.duration,
                data : data._data,
                channelData : data._channelData
            })
        })
    }
    const theta = random(0, 360) / 180 * Math.PI;
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
    let lastUpdate = Date.now();
    const video = setInterval(() => {
        const now = Date.now();
        const diff = (now - lastUpdate) / 1000;
        lastUpdate = now;
        // DRAW
        // rect
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = square.color;
        context.fillRect(square.location.x, square.location.y, square.size.width, square.size.height);
        // fps
        context.textAlign = "right";
        context.textBaseline = "bottom";
        context.fillStyle = "red";
        context.fillText(Math.floor(1 / diff), canvas.width - 10, canvas.height - 10)
        // mouse
        context.fillStyle = "green";
        context.fillRect(mouse.x - 5, mouse.y - 5, 10, 10);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        socket.emit("video", {
            x : 0,
            y : 0,
            width : canvas.width,
            height : canvas.height,
            data
        });        
        // UPDATE
        square.location.x = square.location.x + square.velocity.x * diff;
        square.location.y = square.location.y + square.velocity.y * diff;
        if(square.location.x <= 0 && square.velocity.x < 0) {
            square.velocity.x = -square.velocity.x;
            bounce();
        }
        if(square.location.y <= 0 && square.velocity.y < 0) {
            square.velocity.y = -square.velocity.y;
            bounce();
        }
        if(square.location.x + square.size.width >= canvas.width  && square.velocity.x > 0) {
            square.velocity.x = -square.velocity.x;
            bounce();
        }
        if(square.location.y + square.size.height >= canvas.height  && square.velocity.y > 0) {
            square.velocity.y = -square.velocity.y;
            bounce();
        } 
    }, 1000 / 60);
    socket.on("mousemove", (event) => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
    socket.on('disconnect', () => {
        clearInterval(video);
    });
});

server.listen(80, () => console.log("ready"));