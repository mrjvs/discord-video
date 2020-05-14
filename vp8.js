const sodium = require("libsodium-wrappers");

const headerStr = "BEDE0003324D408322000924510002009080"
const headerStrPart = "BEDE0003324D408322000924510002008080"
const headerStrthird = "BEDE0004324D48B422000BF451000040000000008080"

const headerSingle = "BEDE0004324D48B422000BF451000040000000009080"

function makevp8Frame({pictureId}, frameData, index, len) {
    const str = [headerStr, headerStrPart, headerStrthird, headerSingle];
    let i;
    if (len == 1 && index == 0)
        i = 3;
    else if (index == 0)
        i = 0;
    else if (index == len - 1)
        i = 1;
    else
        i = 2;
    const headerBuf = Buffer.from(str[i], "hex");
    const pictureIdBuf = Buffer.alloc(2);

    pictureIdBuf.writeUIntLE(pictureId, 0, 2);
    pictureIdBuf[0] |= 0b10000000; // mark first bit

    return Buffer.concat([headerBuf, pictureIdBuf, frameData]);
}

function makeRtpHeader({sequence, timestamp, ssrc}, index, len) {
    const packetHeader = Buffer.alloc(12);

    packetHeader[0] = 0x90; // set version and flags
    packetHeader[1] = 0x67; // set packet payload (vp8)
    if (index == len - 1)
        packetHeader[1] |= 0b10000000; // mark first bit

    packetHeader.writeUIntBE(sequence, 2, 2);
    packetHeader.writeUIntBE(timestamp, 4, 4);
    packetHeader.writeUIntBE(ssrc, 8, 4);
    return packetHeader;
}

function encryptData(data, secretkey, nonce) {
    return sodium.crypto_secretbox_easy(data, nonce, secretkey);
}

function makeNonceBuffer(nonceNum) {
    const nonceBuffer = Buffer.alloc(24)
    nonceBuffer.writeUInt32BE(nonceNum, 0);
    return nonceBuffer;
}

function makeCustomPacket({sequence, nonceNum, timestamp, ssrc, secretkey, pictureId}, rawdata, count, len) {
    const packetHeader = makeRtpHeader({
        sequence,
        timestamp,
        ssrc
    }, count, len);
    const packetData = makevp8Frame({
        pictureId,
    }, rawdata, count, len);
    const nonceBuffer = makeNonceBuffer(nonceNum);
    return Buffer.concat([packetHeader, encryptData(packetData, secretkey, nonceBuffer), nonceBuffer.slice(0, 4)]);
}

function incrementPacketValues(obj) {
    obj.sequence++;
    obj.nonceNum++;
    return obj;
}

function incrementFramePacketValues(obj) {
    obj.timestamp += 8730;
    obj.pictureId++;
    return obj;
}

function getInitialPacketValues(obj) {
    obj.sequence = 0;
    obj.timestamp = 3382396944;
    obj.nonceNum = 0;
    obj.pictureId = 0;
    return obj;
}

module.exports = {
    makeCustomPacket,
    incrementPacketValues,
    getInitialPacketValues,
    incrementFramePacketValues
};
