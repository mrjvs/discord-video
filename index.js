const { Client } = require("./discord");
const token = require("./config.js");

const client = new Client();

const testGuild = "688771220706951189";
const testVoice = "688808948325023952";
const logChannel = "709087953145561188";

const prefix = "$";

function playVoice(voice) {
    voice.playAudioFile("./tests/vio.mp3");
}

async function playVideo(voice) {
    await voice.playVideoFile("./tests/el.ivf", "./tests/el.mp3");
}

// guild create event
client.events.on("guild", (guild) => {
    if (testGuild !== guild.id)
        return
    client.joinVoice(guild.id, testVoice, playVideo);
});

// ready event
client.events.on("ready", () => {
    console.log(`--- bot is ready ---`);
    client.sendMessage("Booting done", logChannel);
});

client.events.on("message", (msg) => {
    if (msg.author.bot)
        return
    if (!msg.guild_id)
        return

    if (msg.content.startsWith(`${prefix}playsong`)) {
        client.sendMessage("Joined voice and playing song!", msg.channel_id);
        client.joinVoice(msg.guild_id, testVoice, playVoice);
        return
    }
    
    if (msg.content.startsWith(`${prefix}playvideo`)) {
        client.sendMessage("Joined voice and playing video!", msg.channel_id);
        client.joinVoice(msg.guild_id, testVoice, playVideo);
        return;
    }
});

client.login(token);
