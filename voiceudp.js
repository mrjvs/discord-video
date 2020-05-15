var fs = require('fs');
const udpCon = require('dgram');
const prism = require('prism-media');

const { readIvfFile, getFrameFromIvf} = require("./ivfreader");
const { partitionVideoData, getInitialVideoValues, createVideoPacket, incrementVideoFrameValues } = require("./codecs/vp8");
const { createAudioPacket, incrementAudioValues } = require("./codecs/opus");

const max_nonce = 2 ** 32 - 1;
const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];

function sleep(i) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, i);
    });
}

class VoiceUdp {
    constructor() {
        this.nonce = 0;
        this.noncetwo = 0;
        this.time = 0;
        this.sequence = 0;
    }

    getNewNonceBuffer() {
        const nonceBuffer = Buffer.alloc(24)
        this.nonce++;
        if (this._nonce > max_nonce) this.nonce = 0;
            nonceBuffer.writeUInt32BE(this.nonce, 0);
        return nonceBuffer;
    }

    getNewSequence() {
        this.sequence++;
        if (this.sequence >= 2 ** 16) this.sequence = 0;
        return this.sequence;
    }

    setData(d) {
        this.ssrc = d.ssrc;
        this.address = d.ip;
        this.port = d.port;
        this.modes = d.modes;
    }

    setSession(d) {
        this.secretkey = new Uint8Array(d.secret_key);
    }

    async sendAudioFile(filepath) {
        // make ffmpeg stream
        const args = ['-i', filepath, ...FFMPEG_ARGUMENTS];
        const ffmpeg = new prism.FFmpeg({ args });

        // make opus stream
        const opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
        ffmpeg.pipe(opus);

        // send stream data
        let c = 0;
        opus.on("data", async (chunk) => {
            c++;
            setTimeout(() => {
                const packet = createAudioPacket(this, chunk);
                this.sendPacket(packet);
            }, c * 20);
        });
    }

    async sendVideo(filepath) {
        const ivfFile = readIvfFile(filepath);
        if (!ivfFile) return; // panic

        let options = {
            ssrc: this.ssrc + 1,
            secretkey: this.secretkey,
            mtu: 1200 // max seems to be around 1425 bytes for discord
        };
        options = getInitialVideoValues(options);

        console.log("--- start video generation ---");
        for (let i = 0; i < ivfFile.frameCount; i++) {
            const frame = getFrameFromIvf(ivfFile, i + 1);
            if (!frame) return; // panic
    
            const data = partitionVideoData(options.mtu, frame.data);
    
            console.log("Creating batch of frame packets");
            for (let i = 0; i < data.length; i++) {
                const packet = createVideoPacket(this, options, data[i], i, data.length);
                this.sendPacket(packet);
            }
            await sleep(20);
            options =  incrementVideoFrameValues(options);
        }
    }

    sendPacket(packet) {
        return new Promise((resolve, reject) => {
            this.udp.send(packet, 0, packet.length, this.port, this.address, (error, bytes) => {
                if (error) {
                    console.log("ERROR", error);
                    return reject(error);
                }
                console.log("SENT PACKET", bytes);
                resolve();
            });
        });
    }

    handleIncoming(buf) {
        console.log("RECEIVED PACKET");
    }

    createUdp() {
        return new Promise((resolve, reject) => {
            this.udp = udpCon.createSocket('udp4');
            this.udp.on('error', e => {
                console.error("UDP ERR", e);
            });
            this.udp.on('close', () => {
                console.log("UDP CLOSED");
            });
            this.udp.once('message', this.handleIncoming);
            resolve(true);
        });
    }
}

module.exports = {
    VoiceUdp
};
