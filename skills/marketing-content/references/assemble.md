# Video assembly — exact commands from the "AI is optional" promo

Record segments (run vhs FROM the working dir; relative output paths only):

```sh
vhs segA.tape   # → segA.mp4 (paste IDs → cards)
vhs segB.tape   # → segB.mp4 (english → AI)
```

QA the AI roll before assembling — read the prose, re-roll if it speculates:

```sh
ffmpeg -y -sseof -1 -i segB.mp4 -frames:v 1 -update 1 segB_last.png
```

Title cards (1400x1150 to match the tapes; bg `#08090c` sampled from a real
frame; JetBrains Mono; ~2s with 0.25s fades):

```sh
FB=/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf
FR=/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf
ffmpeg -y -f lavfi -i "color=c=0x08090c:s=1400x1150:d=2:r=30" -vf "\
drawtext=fontfile=$FB:text='just paste an ID':fontcolor=0xe6e0d2:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-50,\
drawtext=fontfile=$FR:text='no AI — straight to the cards':fontcolor=0x9aa0aa:fontsize=36:x=(w-text_w)/2:y=h/2+45,\
fade=t=in:d=0.25,fade=t=out:st=1.75:d=0.25" -pix_fmt yuv420p card1.mp4
```

(Intro card: product name in amber `0xd9a353`, fontsize 72.)

Concat + music in one pass. TOTAL = sum of all clip durations (ffprobe each);
audio fades out over the last 3s, video fades to black over the last 0.74s:

```sh
ffmpeg -y -i card0.mp4 -i card1.mp4 -i segA.mp4 -i card2.mp4 -i segB.mp4 \
  -i music.mp3 \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,fade=t=out:st=<TOTAL-0.74>:d=0.74[v];\
[5:a]atrim=0:<TOTAL>,afade=t=in:d=0.5,afade=t=out:st=<TOTAL-3>:d=3,volume=0.9[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart <repo-root>/out/<name>.mp4
```

Final QA: extract frames at several timestamps and look at them:

```sh
for t in 1.1 3.2 8 15 20 30; do
  ffmpeg -y -ss $t -i <repo-root>/out/<name>.mp4 -frames:v 1 -update 1 qa_$t.png
done
```
