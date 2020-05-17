# discord-video
Video for discord bots

## current status
video working. can only run ivf files
**Warning:** still a spaghettifest

## contributing
Mess around in `codecs/vp8.js` to change the way packets are generated

#### running
configuration:
```JS
module.exports = "BOT TOKEN HERE"
```

### make video to play
```SH
./ffmpeg.exe -i "INPUT" -f ivf OUTPUT.ivf
```