const { Writable } = require("stream");
const { createAudioPacket } = require("../codecs/opus");

const FRAME_LENGTH = 20;

class AudioStream extends Writable {

    constructor(options) {
        super(options);
        this.udp = options.udp;
        this.count = 0;
    }

    _write(chunk, _, callback) {
        if (!this.startTime)
            this.startTime = Date.now();

        const packet = createAudioPacket(this.udp, chunk);
        this.udp.sendPacket(packet);

        const next = FRAME_LENGTH + this.count * FRAME_LENGTH - (Date.now() - this.startTime);
        setTimeout(() => {
            callback();
        }, next);
        this.count++;
    }
}

module.exports = {
    AudioStream
};
