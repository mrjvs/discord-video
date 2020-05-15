var fs = require('fs');
const sodium = require("libsodium-wrappers");
const udpCon = require('dgram');
const prism = require('prism-media');

const ffmpegPath = require("ffmpeg-static");
const { execFile } = require("child_process");

const { incrementPacketValues, partitionData, getInitialPacketValues, makeCustomPacket, incrementFramePacketValues } = require("./vp8");

const max_nonce = 2 ** 32 - 1;
const time_inc = (48000 / 100) * 2;
const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];

//const FFMPEG_ARGUMENTS_VID = "-codec:v libvpx -quality good -cpu-used 0 -b:v 600k -qmin 10 -qmax 42 -maxrate 500k -bufsize 1000k -threads 2 -vf scale=-1:480 -an -pass 1 -f webm".split(" ");
// const FFMPEG_ARGUMENTS_VID = "-f webm -header -codec:v libvpx -minrate 1M -maxrate 1M -b:v 1M".split(" ");
const FFMPEG_ARGUMENTS_VID = "-re -f rtp -an -c:v copy -minrate 1M -sdp_file video.sdp -maxrate 1M -b:v 1M".split(" ");

console.log(FFMPEG_ARGUMENTS_VID);

class VoiceUdp {
    constructor() {
        this.nonce = 0;
        this.noncetwo = 0;
        this.time = 0;
        this.timetwo = 0;
        this.sequence = 0;
        this.sequencetwo = 0;
    }

    getNonce() {
        const nonceBuffer = Buffer.alloc(24)
        this.nonce++;
        if (this._nonce > max_nonce) this.nonce = 0;
            nonceBuffer.writeUInt32BE(this.nonce, 0);
        return nonceBuffer;
    }

    getNonceVideo() {
        const nonceBuffer = Buffer.alloc(24)
        this.noncetwo++;
        if (this.noncetwo > max_nonce) this.noncetwo = 0;
            nonceBuffer.writeUInt32BE(this.noncetwo, 0);
        return nonceBuffer;
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

    encrypt(data, nonce) {
        return sodium.crypto_secretbox_easy(data, nonce, this.secretkey);
    }

    createPacket(data) {
        let packetHeader = Buffer.alloc(12);

        packetHeader[0] = 0x80;
        packetHeader[1] = 0x78;
        packetHeader.writeUIntBE(this.sequence, 2, 2);
        packetHeader.writeUIntBE(this.time, 4, 4);
        packetHeader.writeUIntBE(this.ssrc, 8, 4);

        this.time += time_inc;
        if (this.time >= 2 ** 32) this.time = 0;
        this.sequence++;
        if (this.sequence >= 2 ** 16) this.sequence = 0;
        const nonceBuffer = this.getNonce();
        return Buffer.concat([packetHeader, this.encrypt(data, nonceBuffer), nonceBuffer.slice(0, 4)]);
    }

    createVideoPacket(data) {
        if (!this.timesteps) {
            this.timesteps = 0;
        }
        let packetHeader = Buffer.alloc(12);

        packetHeader[0] = 0x80; //
        packetHeader[1] = 0xc8; // e6 => h264
        packetHeader.writeUIntBE(this.sequencetwo, 2, 2);
        packetHeader.writeUIntBE(this.timetwo, 4, 4);
        packetHeader.writeUIntBE(this.ssrc + 1, 8, 4);

        if (this.timesteps > 30) {
            this.timetwo += time_inc;
            if (this.timetwo >= 2 ** 32) this.timetwo = 0;
            this.timesteps = 0;
        }
        this.timesteps++;
        this.sequencetwo++;
        if (this.sequencetwo >= 2 ** 16) this.sequencetwo = 0;
        const nonceBuffer = this.getNonceVideo();
        return Buffer.concat([packetHeader, this.encrypt(data, nonceBuffer), nonceBuffer.slice(0, 4)]);
    }

    sendFile() {
        // make ffmpeg stream
        const args = ['-i', "./vio.mp3", ...FFMPEG_ARGUMENTS];
        const ffmpeg = new prism.FFmpeg({ args });

        // make opus stream
        const opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
        ffmpeg.pipe(opus);

        // send stream data
        let c = 0;
        opus.on("data", (chunk) => {
            c++;
            setTimeout(() => {
                this.sendPacket(chunk);
            }, c * 20);
        });
    }

    sleep(i) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, i);
        });
    }

    async sendVideo() {
        // make ffmpeg stream
        // const process = execFile([ffmpegPath, '-i', "./el.mp4", ...FFMPEG_ARGUMENTS_VID].join(" "));
        // const ffmpeg = process.stdout;
        // const args = ['-i', "./el.mp4", ...FFMPEG_ARGUMENTS_VID];
        // const ffmpeg = new prism.FFmpeg({ args });

        // // const ffmpeg = fs.createReadStream("./el.mp4", {
        // //     highWaterMark: 64
        // // });

        // // // send stream data
        // let c = 0;
        // ffmpeg.on("data", (chunk) => {
        //     //console.log(chunk, chunk.toString());
        //     setTimeout(() => {
        //         this.sendVideoPacket(chunk);
        //     }, 1);
        // });

        // ffmpeg.on("message", (chunk) => {
        //     console.log("messaged");
        // });

        // ffmpeg.on("start", (chunk) => {
        //     console.log("started");
        // });

        // ffmpeg.on("end", () => {
        //     console.log("stopped");
        // })
        // ffmpeg.on("exit", () => {
        //     console.log("stopped");
        // })
        // ffmpeg.on("error", (err) =>{
        //     console.log(err);
        // })

        // return ;
        let lastnum = 0;
        let i = 0;
        let firstpass = true;
        let sequence = 0;
        let nonceNum = 0;

        let randonum = 0;
        let timestamp = 0;

        let packetStart = 0;
        let shouldend = false;

        let passCounter = 0;

        let timestampMap = {};

        let dataList = [];

        // sending packets
        const sdfg = require("./packets/converted-lagapacket.json");
        let indexstart = 16;
        for (let id = indexstart; true; id++) {
            let packet = sdfg.packets[id];
            if (/*id >= 17 sdfg.packets.length*/shouldend) {
                id = indexstart-1;
                firstpass = false;
                timestamp += 8730;
                packetStart = 0;
                shouldend = false;
                passCounter++;
                console.log("--- started frame ---");
                
                fs.writeFileSync("./testdata0.packet", dataList[0]);
                fs.writeFileSync("./testdata1.packet", dataList[1]);
                fs.writeFileSync("./testdata2.packet", dataList[2]);
                return
                //await this.sleep(10000);
                continue;
            }
            // skip the wierd packets
            if (packet.type === "other") {
                console.log("rtx packet ignored");
                continue
            }

            // get data
            const decryptedData = Buffer.from(packet.dataDecrypted, "hex");
            const nonceBuffer = Buffer.alloc(24);
            nonceBuffer.writeUIntBE(nonceNum, 0, 4);
            let packetHeader = Buffer.from(packet.header, "hex");

            // difference of timestamps
            // const curnum = packetHeader.readUIntBE(4, 4);
            // console.log(curnum - lastnum);
            // if (curnum - lastnum == 0) {

            // }
            // lastnum = curnum;

            // make header
            let ssrcNum = packetHeader.readUIntBE(8, 4);
            let ssrcIndex = sdfg.ssrc.indexOf(ssrcNum);
            if (ssrcIndex == -1) {
                console.log("fucked up packet found");
                continue ;
            }
            if (ssrcIndex == 2) {
                //console.log("rtx packet ignored");
                continue
            }
            if (ssrcIndex == 0) {
                //console.log("voice packet ignored");
                continue
            }
            packetHeader.writeUIntBE(this.ssrc + ssrcIndex, 8, 4);
            //packetHeader.writeUIntBE(this.sequencetwo, 2, 2);
            //const seq = packetHeader.readUIntBE(2, 2);
            const num = packetHeader.readUIntBE(4, 4);
            // if (firstpass) {
            //     if (timestamp && num != timestamp) {
            //         timestampMap[id.toString()] = 8730;
            //         timestamp += 8730;
            //     } else {
            //         timestampMap[id.toString()] = 0;
            //     }
            //     //timestamp = num;
            //     sequence = seq;
            // }
            // else {
            //     timestamp += timestampMap[id.toString()];
            //     if (timestamp >= 2 ** 32) timestamp = 0;
            //     sequence++;
            //     if (sequence >= 2 ** 16) sequence = 0;
            // }

            if (!timestamp) {
                timestamp = num;
                console.log(num);
            }
            packetHeader.writeUIntBE(sequence, 2, 2);
            packetHeader.writeUIntBE(timestamp, 4, 4);
            // lastnum++;
            // if (lastnum > 17) {
            //     timestamp++;
            //     lastnum = 0;
            // }

            // update sequence number
            // this.sequencetwo++;
            // if (this.sequencetwo >= 2 ** 16) this.sequencetwo = 0;
            // this.timetwo += 1;
            // if (this.timetwo >= 2 ** 32) this.timetwo = 0;

            // randonum++;
            // if (randonum > 30)
            //     return
            // fs.writeFileSync(`./data/packet-${randonum}`, Buffer.concat([Buffer.from(packet.header, "hex"), decryptedData]));

            if (decryptedData[12] == 0x51) {
                decryptedData[13] = 0;
                decryptedData[14] = 0;
            }

            if (decryptedData[16] == 0x90) {
                //decryptedData[16] = 0x90;

                if (packetStart != 0) {
                    shouldend = true;
                    continue;
                }
                console.log("is first frame: ");
                packetStart++;
            }

            if (decryptedData[16] == 0x90 || decryptedData[16] == 0x80) {
                const oldpictureId = Buffer.alloc(2);
                decryptedData.copy(oldpictureId, 0, 18, 20);

                // set new picture id and marker
                decryptedData.writeUIntLE(passCounter, 18, 2);
                decryptedData[18] |= 0b10000000;

                const newpictureId = decryptedData.slice(18, 20);
                console.log({packet: id, oldpictureId, newpictureId});

                const newData = Buffer.alloc(decryptedData.length - 20);
                decryptedData.copy(newData, 0, 20)
                dataList.push(newData);
            }
            
            if (decryptedData[20] == 0x90 || decryptedData[20] == 0x80) {
                const oldpictureId = Buffer.alloc(2);
                decryptedData.copy(oldpictureId, 0, 22, 24);

                // set new picture id and marker
                decryptedData.writeUIntLE(passCounter, 22, 2);
                decryptedData[22] |= 0b10000000;

                const newpictureId = decryptedData.slice(22, 24);
                console.log({packet: id, oldpictureId, newpictureId});

                const newData = Buffer.alloc(decryptedData.length - 24);
                decryptedData.copy(newData, 0, 24)
                dataList.push(newData);
            }

            // combine and encrypt data
            const finalPacket = Buffer.concat([packetHeader, this.encrypt(decryptedData, nonceBuffer), nonceBuffer.slice(0, 4)]);
            sequence++;
            nonceNum++;

            fs.writeFileSync("./pack" + sequence + ".bin", finalPacket);

            // send packet
            //console.log("packet ", id);
            this.sendVideoPacket(finalPacket);

            // wait before sending the next one
            await this.sleep(1);
        }
    }

    async sendFrame(filepath) {
        let options = {
            ssrc: this.ssrc + 1,
            secretkey: this.secretkey,
            mtu: 1200 // max seems to be around 1425 bytes for discord
        };
        options = getInitialPacketValues(options);

        const data = partitionData(options.mtu, fs.readFileSync(filepath, { encoding: null }));

        console.log("--- start video generation ---");
        while (true) {
            console.log("Creating batch of frame packets");
            for (let i = 0; i < data.length; i++) {
                const packet = makeCustomPacket(options, data[i], i, data.length);
                options = incrementPacketValues(options);
                this.sendVideoPacket(packet);
                await this.sleep(5);
            }
            options =  incrementFramePacketValues(options);
        }
    }

    sendPacket(data) {
        return new Promise((resolve, reject) => {
            const packet = this.createPacket(data);
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

    sendVideoPacket(packet) {
        return new Promise((resolve, reject) => {
            this.udp.send(packet, 0, packet.length, this.port, this.address, (error, bytes) => {
                if (error) {
                    console.log("VIDEO ERROR", error);
                    return reject(error);
                }
                console.log("SENT VIDEO PACKET", bytes, packet.length);
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
