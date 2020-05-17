const fs = require("fs");

/* --------------------------- write packet files from converted json ------------------------ */
//const asdf = require("./converted-lagapacket.json");
// let i = 0;

// let otherpackets = 0;

// for (let packet of asdf.packets) {
//     if (packet.type !== "rtp" || packet.packetType != "video") {
//         otherpackets++;
//         continue ;
//     }
    
//     const header = Buffer.from(packet.header, "hex");
//     const data = Buffer.from(packet.dataDecrypted, "hex");

//     const out = Buffer.concat([header, data]);
//     fs.writeFileSync(`./alldata/${String(i).padStart(4, '0')}-video.packet`, out);
//     i++;
// }

// console.log(`Wrote ${i} packets. `, `Skipped ${otherpackets} packets. `);

/* ------------------------------ make ivf file from generated packets ------------------------ */
const packetCount = 1578;
const width = 960;
const height = 360;
const outputPath = './recorded.ivf';
const outputPathStats = './recorded-stats.json';

const output = fs.createWriteStream(outputPath);
const outputStats = {
    ext: {}
};

// ivf file header
const fileHeader = Buffer.alloc(32);
fileHeader.write("DKIF", 0);
fileHeader.writeUInt32LE(0, 4);
fileHeader.writeUInt32LE(32, 6);
fileHeader.write("VP80", 8);
fileHeader.writeUInt32LE(width, 12); // width unknown
fileHeader.writeUInt32LE(height, 14); // height unknown
fileHeader.writeBigInt64LE(BigInt(30), 16); // framerate guessed
fileHeader.writeBigInt64LE(BigInt(1), 20);
output.write(fileHeader);

let i = 0;
let framecount = 0;

let frameBuffer = [];

// loop over frames
for (let i = 0; i < packetCount; i++) {
    let offset = 12; // to skip header

    const packet = fs.readFileSync(`./alldata/${String(i).padStart(4, '0')}-video.packet`, { encoding: null });

    let isLastOfFrame = false;
    if ((packet[1] & 0b10000000) == 0b10000000) {
        isLastOfFrame = true;
    }

    // skip extensions
    if (packet[offset] == 0xBE && packet[offset + 1] == 0xDE) {
        // get extension counter
        let len = packet.readUInt16BE(offset + 2);

        // skip to extensions start
        offset += 4;

        // loop over extensions
        while (len > 0) {
            // get extension byte length
            const id = ((packet[offset] & 0b11110000) >> 4).toString();
            packet[offset] &= 0b00001111;
            let extlen = packet.readUInt8(offset) + 1;

            // stats
            if (!outputStats.ext[id]) {
                outputStats.ext[id] = {
                    data: [],
                    values: []
                }
            }
            const value = packet.slice(offset + 1, offset + 1 + extlen).toString("hex");
            outputStats.ext[id].data.push({
                len: extlen - 1,
                value,
            });
            outputStats.ext[id].values.push(value);

            // set offset to next extension
            offset += extlen + 1;

            // update counter
            len--;

            // skip padding
            while (packet[offset] == 0) {
                offset++;
            }
        }
    }

    offset += 4; // vp8 payload header
    // remove all headers from packet, only leaves vp8 data
    const outputPacket = packet.slice(offset);
    frameBuffer.push(outputPacket);

    if (isLastOfFrame) {
        const outputFrame = Buffer.concat(frameBuffer);
        frameBuffer = [];

        // make frame header
        const frameheader = Buffer.alloc(12);
        frameheader.writeUInt32LE(outputFrame.length, 0);
        frameheader.writeBigInt64LE(BigInt(framecount), 4);

        framecount++; // increment counter

        // write entire frame to file
        output.write(Buffer.concat([frameheader, outputFrame]));
    }
}

// called after writing all frame data
output.on("finish", () => {
    const outputFile = fs.readFileSync(outputPath, { encoding: null });

    // update framecount
    outputFile.writeBigInt64LE(BigInt(framecount), 24);
    fs.writeFileSync(outputPath, outputFile);

    // stats
    outputStats.frames = framecount;
    fs.writeFileSync(outputPathStats, JSON.stringify(outputStats, null, 2));

    // logging
    console.log(`Wrote ${framecount} frames to file.`);
});

// end stream
output.end();
