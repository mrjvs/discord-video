var fs = require('fs');
const udpCon = require('dgram');
const prism = require('prism-media');

const { streamVideoFile } = require("../media/videoHandler");
const { streamAudioFile } = require("../media/audioHandler");

const max_nonce = 2 ** 32 - 1;

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

    async playAudioFile(filepath) {
        return await streamAudioFile(this, filepath);
    }

    async playVideoFile(filepath) {
        return await streamVideoFile(this, filepath);
    }

    sendPacket(packet) {
        return new Promise((resolve, reject) => {
            this.udp.send(packet, 0, packet.length, this.port, this.address, (error, bytes) => {
                if (error) {
                    console.log("ERROR", error);
                    return reject(error);
                }
                resolve();
            });
        });
    }

    handleIncoming(buf) {
        //console.log("RECEIVED PACKET");
    }

    createUdp() {
        return new Promise((resolve, reject) => {
            this.udp = udpCon.createSocket('udp4');
            this.udp.on('error', e => {
                console.error("Error connecting to media udp server", e);
            });
            this.udp.once('message', this.handleIncoming);
            resolve(true);
        });
    }
}

module.exports = {
    VoiceUdp
};
