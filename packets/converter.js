const fs = require("fs");
const sodium = require("libsodium-wrappers");
const { decrypt } = require("./convert");

async function run() {
    await sodium.ready;

    const keys = [238,210,176,189,28,69,238,75,9,184,117,18,222,74,22,154,227,96,128,185,29,202,216,49,204,22,248,97,228,81,6,135];
    const secretkey = new Uint8Array(keys);
    const ssrc = [453268, 453269, 453270]
    let i = 0;
    const packets = require("./lagapacket-stripped.json");

    let output = {
        comment: "laga packet data",
        keys: keys,
        ssrc: ssrc,
        packets: []
    }

    for (let packet of packets) {
        const rawbuf = packet._source.layers.data["data.data"].split(":").join("");
        const data = decrypt(secretkey, rawbuf, ssrc);
        if (data) {
            output.packets.push(data);
        }
    }

    fs.writeFileSync("./converted-lagapacket.json", JSON.stringify(output));
    console.log("--- done ---");
}

run().catch(console.error);
