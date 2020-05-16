const fs = require("fs");
const sodium = require("libsodium-wrappers");

async function init() {
    await sodium.ready;

    function encryptData(data, secretkey, nonce) {
        return sodium.crypto_secretbox_easy(data, nonce, secretkey);
    }
    
    const asdf = fs.readFileSync("./oof/encrypted", { encoding: null });
    const nonce = asdf.slice(asdf.length - 4);

    const nonceBuf = Buffer.alloc(24);
    nonce.copy(nonceBuf, 0, 0, 4);

    console.log(nonceBuf, nonce);

    const payloadBuf = fs.readFileSync("./oof/payload", { encoding: null });
    const secretBuf = fs.readFileSync("./oof/key", { encoding: null });

    const encrypted = encryptData(payloadBuf, secretBuf, nonceBuf);
    
    fs.writeFileSync("./oof/testencrypted", encrypted);
}

init();
