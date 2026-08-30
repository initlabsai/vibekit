#!/usr/bin/env bash
# Lay a track under a finished cut.
#
#   add-music.sh <in.mp4> <track.mp3> <out.mp4> [start-seconds] [fade-out-seconds]
#
# Trims the track to the video's length, fades in 0.5s and out over the tail,
# and ducks to 0.85. START skips a track's quiet intro -- measure it, don't
# guess:
#   ffmpeg -hide_banner -ss 30 -t 6 -i t.mp3 -af volumedetect -f null /dev/null
# (needs default log level; -v error hides the summary). Per-track offsets are
# in references/brand.md.
set -eu
IN="$1"; TRACK="$2"; OUT="$3"; START="${4:-0}"; FADE="${5:-3}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
AOUT=$(awk "BEGIN{printf \"%.2f\", $DUR-$FADE}")
ffmpeg -y -loglevel error -i "$IN" -ss "$START" -i "$TRACK" -filter_complex \
  "[1:a]atrim=duration=$DUR,asetpts=PTS-STARTPTS,afade=t=in:d=0.5,afade=t=out:st=$AOUT:d=$FADE,volume=0.85[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart "$OUT"
echo "wrote $OUT  (${DUR}s, track from ${START}s)"
