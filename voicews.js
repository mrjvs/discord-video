const WebSocket = require('ws');
const { VoiceUdp } = require("./voiceudp");

const {
    botId,
    ip
} = require("./constants");

class Voice {
    constructor(guild, hasvideo) {
        this.hasSession = false;
        this.hasTokens = false;
        this.hasvideo = hasvideo;
        this.started = false;
        this.udp = new VoiceUdp(this);

        this.guild = guild;
        console.log("INITIALISING VOICE");
    }

    stop() {
        clearInterval(this.interval);
        this.ws.close();
    }

    setSession(session) {
        this.session = session;
        this.hasSession = true;
        console.log("GOT SESSION");
        this.start();
    }
    
    setTokens(server, token) {
        this.token = token;
        this.server = server;
        this.hasTokens = true;
        console.log(server);
        console.log("GOT TOKENS");
        this.start();
    }

    start() {
        if (this.hasSession && this.hasTokens) {
            if (this.started)
                return
            this.started = true;
            this.ws = new WebSocket("ws://" + this.server + "/?v=5", {
                followRedirects: true
            });
            this.ws.on("error", (err) => {
                console.error(err);
            })
            this.ws.on("close", (err) => {
                console.error("closed voice");
            })
            this.setupEvents();
        }
    }

    handleReady(d) {
        this.ssrc = d.ssrc;
        this.address = d.ip;
        this.port = d.port;
        this.modes = d.modes;
        console.log("ready", d);
        this.udp.setData(d);
        console.log("received ready");
    }

    handleSession(d) {
        this.secretkey = d.secret_key;
        console.log("session", d);
        this.udp.setSession(d);
    }

    setupEvents() {
        this.sequence = null;
        this.ws.on('message', (data) => {
            const { op, d } = JSON.parse(data);
            if (op == 2) { // ready
                console.log(d);
                this.handleReady(d);
                this.sendProtocol();
                this.sendtwelve();
                this.setSpeaking(true);
            }
            else if (op === 6) { // heartbeat ack
                console.log('VOICE HEARTBEAT ACK');
            }
            else if (op >= 4000) { // error codes
                console.log('ERROR');
                console.log(d);
            }
            else if (op === 8) { // hello
                this.setupHeartbeat(d.heartbeat_interval);
                this.identify();
            }
            else if (op === 4) { // session description
                console.log("Session description", {op, d});
                this.handleSession(d);
                this.sendVoice();
            }
            else if (op === 5) {
                // ignore speaking updates
            }
            else {
                console.log("unhandled voice event", {op, d});
            }
        });
    }

    identify() {
        this.ws.send(JSON.stringify({
            op: 0,
            d: {
                server_id: this.guild,
                user_id: botId,
                session_id: this.session,
                token: this.token,
                video: false
            },
        })); 
    }

    sendtwelve() {
        this.ws.send(JSON.stringify({
            op: 12,
            d: {
                audio_ssrc: this.ssrc,
                video_ssrc: this.ssrc + 1,
                rtx_ssrc: this.ssrc + 2,
            },
        }));
    }

    sendProtocol() {
        this.ws.send(JSON.stringify({
            op: 1,
            d: {
                protocol: "udp",
                codecs: [
                    { name: "opus", type: "audio", priority: 1000, payload_type: 120 },
                    { name: "VP8", type: "video", priority: 3000, payload_type: 103, rtx_payload_type: 104 }
                ],
                data: {
                    address: ip,
                    port: 50024,
                    mode: "xsalsa20_poly1305_lite"
                }
            }
        }))
    }

    setSpeaking(bool) {
        this.ws.send(JSON.stringify({
            op: 5,
            d: {
                delay: 0,
                speaking: bool ? 1 : 0,
                ssrc: this.ssrc
            }
        }));
    }

    sendVoice() {
        this.udp.createUdp().then(() => {
            this.udp.sendVideo();
        });
    }

    setupHeartbeat(interval) {
        this.interval = setInterval(() => {
            this.ws.send(JSON.stringify({
                op: 3,
                d: 42069,
            }));
        }, interval);
    }
}

module.exports = {
    Voice
};
