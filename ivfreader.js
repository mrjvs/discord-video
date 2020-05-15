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
        timeDenominator: file.readBigInt64LE(16),
        timeNumerator: file.readUIntLE(20, 4),
        frameCount: file.readUIntLE(24, 4),
        frames: file.slice(32)
    };

    console.log(out.timeDenominator, out.frameCount, out.timeNumerator);

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
    let currentOffset = 0;
    while (true) {
        const size = file.frames.readUIntLE(currentOffset, 4);
        
        // jump to next frame if isnt the requested frame
        if (currentFrame != framenum) {
            currentOffset += 12 + size;
            currentFrame++;
            continue
        }

        // return frame data
        const out = {
            size: size,
            timestamp: file.frames.readBigUInt64LE(currentOffset + 4),
            data: file.frames.slice(currentOffset + 12, currentOffset + 12 + size)
        }
        console.log(out);
        return out;
    }
}

module.exports = {
    getFrameFromIvf,
    readIvfFile
}

// 4299262293296 time denominator
// 1001 time numator
// incremental timestamp