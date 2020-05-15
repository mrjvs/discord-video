const sodium = require("libsodium-wrappers");

function decrypt(key, rawdata, ssrc) {
    const buf = Buffer.from(rawdata, "hex");

    if (buf.length <= 12) {
        console.error("UNKNOWN PACKET TYPE");
    return false;
    }

    const ssrcnumrtp = buf.readUIntBE(8, 4);

    if (ssrc.includes(ssrcnumrtp)) {
        return decryptRtp(key, buf, ssrc);
    }

    const ssrcnumother = buf.readUIntBE(4, 4);
    if (ssrc.includes(ssrcnumother)) {
        return decryptOther(key, buf, ssrc);
    }

    console.error("UNKNOWN PACKET TYPE");
    return false;
}

function decryptRtp(key, buf, ssrc) {
    const nonceBuffer = Buffer.alloc(24);
    buf.copy(nonceBuffer, 0, buf.length - 4);
    
    const header = buf.slice(0, 12);
    const payload = buf.slice(1, 2);
    const ssrcbuf = buf.slice(8, 12);

    const ssrcnum = ssrcbuf.readUIntBE(0, 4);
    let type = "unknown";
    if (ssrcnum === ssrc[0]) {
        type = "audio";
    } else if (ssrcnum === ssrc[1]) {
        type = "video";
    } else if (ssrcnum === ssrc[1]) {
        type = "rtx";
    }

    const data = buf.slice(12, buf.length - 4);

    const dataDecrypted = sodium.crypto_secretbox_open_easy(data, nonceBuffer, key);

    return {
        data: data.toString("hex"),
        dataDecrypted: Buffer.from(dataDecrypted).toString("hex"),
        nonceBuffer: nonceBuffer.toString("hex"),
        header: header.toString("hex"),
        payload: payload.toString("hex"),
        ssrc: ssrcbuf.toString("hex"),
        type: "rtp",
        packetType: type
    };
}

function decryptOther(key, buf, ssrc) {
    const ssrcbuf = buf.slice(4, 8);

    return {
        data: buf.toString("hex"),
        ssrc: ssrcbuf.toString("hex"),
        type: "other"
    };
}

module.exports = {
    decrypt
};
