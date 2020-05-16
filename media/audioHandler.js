const prism = require("prism-media");

const { createAudioPacket } = require("../codecs/opus");
const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];

async function streamAudioFile(voiceUdp, filepath) {
    if (filepath.endsWith(".mp3")) {
        streamMp3File(voiceUdp, filepath);
        return true;
    }
    return false;
}

function streamMp3File(voiceUdp, filepath) {
    // make ffmpeg stream
    const args = ["-i", filepath, ...FFMPEG_ARGUMENTS];
    const ffmpeg = new prism.FFmpeg({ args });
    
    // make opus stream
    const opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
    const opusStream = ffmpeg.pipe(opus);
    
    // send stream data
    let c = 0;
    opusStream.on("data", async (chunk) => {
        c++;
        setTimeout(() => {
            const packet = createAudioPacket(voiceUdp, chunk);
            voiceUdp.sendPacket(packet);
        }, c * 20);
    });
}

module.exports = {
    streamAudioFile
}