const fs = require("fs");

function readIvfFile(filepath) {
    const file = fs.readFileSync(filepath, { encoding: null });

    const out = {
        fullfile: file,
        signature: file.slice(0, 4).toString(),
        version: file.readUIntLE(4, 2),
        headerLength: file.readUIntLE(6, 2),
        codec: file.slice(8, 12).toString(),
        width: file.readUIntLE(12, 2),
        height: file.readUIntLE(14, 2),
        timeDenominator: file.readUIntLE(16, 4),
        timeNumerator: file.readUIntLE(20, 4),
        frameCount: file.readUIntLE(24, 4),
        frames: file.slice(32)
    };

    if (out.signature != "DKIF") {
        console.error("IVf: invalid signature");
        return false
    }

    if (out.version != 0) {
        console.error("IVf: invalid file version");
        return false
    }

    return out;
}

// get frame, starts at one
function getFrameFromIvf(file, framenum = 1) {
    if (!(framenum > 0 && framenum <= file.frameCount))
        return false;
    
    let currentFrame = 1;
    let currentBuffer = file.frames;
    while (true) {
        const size = currentBuffer.readUIntLE(0, 4);

        // jump to next frame if isnt the requested frame
        if (currentFrame != framenum) {
            currentBuffer = currentBuffer.slice(12 + size, currentBuffer.length);
            currentFrame++;
            continue
        }

        // return frame data
        const out = {
            size: size,
            timestamp: currentBuffer.readBigUInt64LE(4),
            data: currentBuffer.slice(12, 12 + size)
        }
        //console.log(out);
        return out;
    }
}

function getFrameDelayInMilliseconds(file) {
    return ((parseFloat(file.timeNumerator) / parseFloat(file.timeDenominator)) * 1000);
}

module.exports = {
    getFrameFromIvf,
    readIvfFile,
    getFrameDelayInMilliseconds
}
