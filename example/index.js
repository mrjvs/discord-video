const { Client } = require("../discord");
const fs = require("fs");
const client = new Client();

const token = require("./config");
const { voiceChannel, guildId } = require("./constants");
const video = "VIDEO FILE HERE";

async function playVideo(voice) {
    console.log("Started playing video");

    // make file streams
    const videoStream = fs.createReadStream(video);
    const audioStream = fs.createReadStream(video);

    // play audio stream
    voice.playAudioFileStream(audioStream, "mp4");

    // play video stream
    await voice.playVideoFileStream(videoStream, "mp4");

    console.log("Finished playing video");
}

// guild create event
client.events.on("guild", (guild) => {
    if (guildId !== guild.id)
        return
    
    // join voice channel
    client.joinVoice(guild.id, voiceChannel, playVideo);
});

// ready event
client.events.on("ready", (user) => {
    console.log(`--- ${user.username}#${user.discriminator} is ready ---`);
});

// message event
client.events.on("message", (msg) => {
    if (msg.author.bot)
        return
    if (!msg.guild_id)
        return

    // handle messages here
});

// login
client.login(token);
