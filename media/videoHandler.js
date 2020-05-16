const { readIvfFile, getFrameFromIvf, getFrameDelayInMilliseconds} = require("./ivfreader");
const { partitionVideoData, getInitialVideoValues, createVideoPacket, incrementVideoFrameValues } = require("../codecs/vp8");

async function streamVideoFile(voiceUdp, filepath) {
    if (filepath.endsWith(".ivf"))
        return await streamIvfFile(voiceUdp, filepath);
    return false;
}

function sleep(i) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, i);
    });
}

async function streamIvfFile(voiceUdp, filepath) {
    const ivfFile = readIvfFile(filepath);
    if (!ivfFile) return false;

    let options = {
        ssrc: voiceUdp.ssrc + 1,
        secretkey: voiceUdp.secretkey,
        mtu: 1200 // max seems to be around 1425 bytes for discord
    };
    options = getInitialVideoValues(options);

    for (let i = 0; i < ivfFile.frameCount; i++) {
        const frame = getFrameFromIvf(ivfFile, i + 1);
        if (!frame) return;

        const data = partitionVideoData(options.mtu, frame.data);

        for (let i = 0; i < data.length; i++) {
            const packet = createVideoPacket(voiceUdp, options, data[i], i, data.length);
            voiceUdp.sendPacket(packet);
        }
        await sleep(getFrameDelayInMilliseconds(ivfFile));
        options = incrementVideoFrameValues(options);
    }
    return true;
}

module.exports = {
    streamVideoFile
};
