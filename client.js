const WebSocket = require('ws');
const axios = require('axios');
const { Voice } = require("./voicews");

const {
    gateway,
    api,
    logChannel,
    testVoice,
    testGuild,
    botId
} = require("./constants");

class Client {
    constructor(gateway, token, shards) {
        this.ws = new WebSocket(gateway);
        this.token = token;
        this.shards = shards;
        this.gateway = gateway;
        this.voiceGuild = {};
        this.setupEvents();
    }

    stop() {
        clearInterval(this.interval);
        this.ws.close();
    }

    start(num, newMax) {
        let heartbeat = null;
        this.ws = new WebSocket(gateway);
        this.setupEvents();
    }

    reset(num, newMax) {
        console.log('resetting connection');
        clearInterval(this.interval);
        this.ws.terminate();
        setTimeout(() => {
            console.log('starting up');
            let heartbeat = null;
            this.ws = new WebSocket(gateway);
            this.setupEvents();
        }, 41000);
    }
    
    setupEvents() {
        let heartbeat = null;
        let startedHeartbeat = false;
        this.sequence = null;
        this.ws.on('message', (data) => {
            const { op, d, s,t  } = JSON.parse(data);
            if (op === 0) {
                this.sequence = s;
                if (t === 'READY') {
                    console.log(this.shardNum + ' READY');
                    console.log('SHARDS = ' + JSON.stringify(d.shard));
                    //console.log('GUILDS = ' + JSON.stringify(d.guilds));
                    this.setStatus('with shard tester.');
                } else if (t === 'GUILD_CREATE') {
                    //console.log(this.shardNum + ' NEW GUILD: ' + d.id);
                    if (d.id === testGuild) {
                        this.sendMessage('Barebones Bot Tester boot successfull!', logChannel);
                        this.joinVoice(testGuild, testVoice);
                    }
                } else if (t === 'MESSAGE_CREATE') {
                    //console.log(d);
                    //console.log(this.shardNum + ' NEW MESSAGE @' + d.author.username + '#' + d.author.discriminator + ': ' + d.content);
                } else if (t === 'MESSAGE_DELETE') {
                    //this.sendMessage('**Received event:**```JSON\n' + JSON.stringify(d) + '```', logChannel);
                } else if (t === "VOICE_STATE_UPDATE") {
                    console.log("VOICE STATUS UPDATE", d);
                    if (d.user_id === botId) {
                        if (typeof this.voiceGuild[d.guild_id] !== "undefined") {
                            console.log("has voice connection");
                            this.voiceGuild[d.guild_id].setSession(d.session_id);
                        }
                    }
                } else if (t === "VOICE_SERVER_UPDATE") {
                    this.voiceGuild[d.guild_id].setTokens(d.endpoint, d.token);
                } else if (t === "PRESENCE_UPDATE") {
                    // ignore presence updates
                } else {
                    //console.log("UNHANDLED EVENT", {t, d});
                }
            }
            if (op === 10) {
                heartbeat = d.heartbeat_interval;
                if (startedHeartbeat === false) {
                    this.setupHeartbeat(heartbeat);
                    startedHeartbeat = true;
                    this.identify();
                }
            }
            if (op === 11) {
                console.log(this.shardNum + ' HEARTBEAT ACK');
            }
            if (op >= 4000) {
                console.log('ERROR CLOSED');
                console.log(d);
            }
        });
    }

    identify() {
        let shard;
        if (this.shards) {
            shard = shards;
        }
        this.ws.send(JSON.stringify({
            op: 2,
            d: {
                token: this.token,
                properties: {
                    $os: 'linux',
                    $browser: 'shardTest',
                    $device: 'shardTest',
                },
                shard
            },
        })); 
    }

    setupHeartbeat(interval) {
        this.interval = setInterval(() => {
            this.ws.send(JSON.stringify({
                op: 1,
                d: this.sequence,
            }));
        }, interval);
    }

    setStatus(text) {
        this.ws.send(JSON.stringify({
            op: 3,
            d: {
                afk: false,
                status: 'online',
                game: {
                    name: text,
                    type: 0
                },
                since: null,
            },
        })); 
    }

    sendMessage(text, channelId) {
        axios({
            url: `${api}/channels/${channelId}/messages`,
            method: 'post',
            data: {
                content: text,
                tts: false,
            },
            headers: {
                'Authorization': 'Bot ' + this.token,
            },
        }).catch((err) => {
            console.error(err);
        });
    }

    joinVoice(guild_id, channel_id) {
        this.voiceGuild[guild_id] = new Voice(guild_id, true);
        this.ws.send(JSON.stringify({
            op: 4,
            d: {
                guild_id,
                channel_id,
                self_mute: false,
                self_deaf: false,
                self_video: true
            }
        }));
    }

    setSettings() {
        axios({
            url: `${api}/users/@me/settings`,
            method: 'patch',
            data: '{"show_current_game": false, "status": "online", "custom_status": {"text": "testing statuses!", "emoji_id": null, "emoji_name": null, "expires_at": "2019-11-17T23:00:00+00:00"}}',
            headers: {
                'Authorization': 'Bot ' + this.token,
            },
        }).then((res) => {
            console.log(res);
        }).catch((err) => {
            console.error(err);
        });
    }
}

module.exports = {
    Client
}