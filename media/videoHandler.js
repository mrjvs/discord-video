const { readIvfFile, getFrameFromIvf, getFrameDelayInMilliseconds} = require("./ivfreader");
const { VideoStream } = require("./videoStream");

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

    const videoStream = new VideoStream({ udp: voiceUdp });
    videoStream.setSleepTime(getFrameDelayInMilliseconds(ivfFile));

    let counter = 0;

    for (let i = 0; i < ivfFile.frameCount; i++) {
        const frame = getFrameFromIvf(ivfFile, i + 1);
        if (!frame) return;

        await new Promise((resolve, reject) => {
            videoStream.write(frame.data, (err) => {
                if (err)
                    reject(err);
                resolve(true);
            });
        })
        counter++;
    }
    console.log(`Sent ${counter} packets for video!`);
    return true;
}

module.exports = {
    streamVideoFile
};
