const sodium = require("libsodium-wrappers");

const headerExtensionString = "BEDE000151000000"
const headerExtensionStringLastFrame = "BEDE00025100004000"

/*
header extension:
0: 0xBE - 1 byte
1: 0xDE - 1 byte
2: LEN - 2 bytes
3: rest of extensions (0 padding following an extension must be ignored)
LEN = amount of header extensions. Little endian

extension structure:
0: identifier - 4 bits
1: length - 4 bits
?: extension data - (length + 1) bytes

extension types: (specific to discord)
---
id 5, length 1 (0x51)
unknown purpose
REQUIRED every packet
can be set to any number and has no visible effect
seems to increment constantly on every packet
---
id 4, length 0 (0x40)
rotates frame
REQUIRED for last packet of the frame
00 -> default, no rotation
01 -> rotate 90 deg clockwise
02 -> rotates 180 deg
03 -> rotates 90 deg counter clockwise
---
*/

function makevp8Frame({pictureId}, frameData, index, len) {

    // header extension
    const str = [headerExtensionString, headerExtensionStringLastFrame];
    let i;
    if (index + 1 == len)
        i = 1;
    else
        i = 0;
    const headerExtensionBuf = Buffer.from(str[i], "hex");

    // vp8 payload descriptor
    const payloadDescriptorBuf = Buffer.alloc(2);

    payloadDescriptorBuf[0] = 0x80;
    payloadDescriptorBuf[1] = 0x80;
    if (index == 0) {
        payloadDescriptorBuf[0] |= 0b00010000; // mark S bit, indicates start of frame
    }

    // vp8 pictureid payload extension
    const pictureIdBuf = Buffer.alloc(2);

    pictureIdBuf.writeUIntLE(pictureId, 0, 2);
    pictureIdBuf[0] |= 0b10000000;

    return Buffer.concat([headerExtensionBuf, payloadDescriptorBuf, pictureIdBuf, frameData]);
}

// data as described in discord documentation, rtp header extensions are not included
function makeRtpHeader({sequence, timestamp, ssrc}, index, len) {
    const packetHeader = Buffer.alloc(12);

    packetHeader[0] = 0x90; // set version and flags
    packetHeader[1] = 0x67; // set packet payload (vp8)
    if (index + 1 == len)
        packetHeader[1] |= 0b10000000; // mark M bit if last frame

    packetHeader.writeUIntBE(sequence, 2, 2);
    packetHeader.writeUIntBE(timestamp, 4, 4);
    packetHeader.writeUIntBE(ssrc, 8, 4);
    return packetHeader;
}

// encrypts all data that is not in rtp header.
// rtp header extensions and payload headers are also encrypted
function encryptData(data, secretkey, nonce) {
    return sodium.crypto_secretbox_easy(data, nonce, secretkey);
}

function createVideoPacket(voiceUdp, {timestamp, ssrc, secretkey, pictureId}, rawdata, count, len) {
    const packetHeader = makeRtpHeader({
        sequence: voiceUdp.getNewSequence(),
        timestamp,
        ssrc
    }, count, len);

    const packetData = makevp8Frame({
        pictureId,
    }, rawdata, count, len);

    // nonce buffer used for encryption. 4 bytes are appended to end of packet
    const nonceBuffer = voiceUdp.getNewNonceBuffer();
    return Buffer.concat([packetHeader, encryptData(packetData, secretkey, nonceBuffer), nonceBuffer.slice(0, 4)]);
}

// TODO, all numbers still need overflow handled correctly
function incrementVideoFrameValues(obj) {
    obj.timestamp += 8730; // random number gotten from packets. needs to be generated (90khz)
    obj.pictureId++; // pictureId increments every frame
    return obj;
}

function getInitialVideoValues(obj) {
    obj.timestamp = 0;
    obj.pictureId = 0;
    return obj;
}

// partitions the data into max size packets
function partitionVideoData(mtu, data) {
    let i = 0;
    let len = data.length;

    const out = [];

    while (len > 0) {
        const size = Math.min(len, mtu);
        out.push(data.slice(i, i + size));
        len -= size;
        i += size;
    }

    return out;
}

module.exports = {
    createVideoPacket,
    getInitialVideoValues,
    incrementVideoFrameValues,
    partitionVideoData
};
