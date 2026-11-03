#!/bin/bash
# Rebuild android res/raw/azan.ogg (#11 Makkah 2018) and azan_fajr.ogg (#6 Malmö) from the Wikimedia Commons originals.
# usage: tools/build-azan.sh <makkah-2018.webm> <malmo-2012.webm>
set -e
RAW=android-app/android/app/src/main/res/raw
proc() { # in out duration denoise-chain gain-dB
  T=$(mktemp --suffix=.wav)
  ffmpeg -y -v error -t "$3" -i "$1" -vn -ac 1 -af "highpass=f=${6:-100}:poles=2,$4,afade=t=in:d=0.3,afade=t=out:st=$(python3 -c "print($3-1.2)"):d=1.2" -c:a pcm_f32le "$T"
  ffmpeg -y -v error -i "$T" -af "volume=$5dB,aresample=176400,alimiter=limit=0.80:attack=2:release=60:level=disabled,aresample=44100" -c:a libvorbis -q:a 6 "$2"
  rm -f "$T"
  ffmpeg -hide_banner -i "$2" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -e "I:" -e "Peak:"
}
proc "$1" $RAW/azan.ogg 189.2 "afftdn=nr=14:nf=-32,equalizer=f=250:t=q:w=1:g=-2.5,equalizer=f=3000:t=q:w=1.2:g=3,acompressor=threshold=-16dB:ratio=2:attack=20:release=300" 10.2 100
proc "$2" $RAW/azan_fajr.ogg 235.0 "afftdn=nr=10:nf=-50,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2.5,acompressor=threshold=-22dB:ratio=2.5:attack=15:release=250:makeup=2" 2 90
