#!/bin/bash
# Rebuild android res/raw/azan.ogg — #9 Mardin, Turkey (Turkish ezan) by emrahddd, Freesound #168652, CC0.
# Used for all five waqts (Fajr included). Source: https://freesound.org/people/emrahddd/sounds/168652/
# usage: tools/build-azan.sh <168652__emrahddd__ezan-mardin.mp3>
# Keeps the full ezan (first Allahu akbar at ~8.1 s to final la ilaha illallah ending ~329.3 s),
# drops the pre-roll noise and the ambient tail. Target ~-12 LUFS integrated, true peak <= -1 dBTP.
set -e
RAW=android-app/android/app/src/main/res/raw
proc() { # in out start duration chain gain-dB [highpass]
  T=$(mktemp --suffix=.wav)
  ffmpeg -y -v error -ss "$3" -t "$4" -i "$1" -vn -ac 1 -af "highpass=f=${7:-100}:poles=2,$5,afade=t=in:d=0.3,afade=t=out:st=$(python3 -c "print($4-1.2)"):d=1.2" -c:a pcm_f32le "$T"
  ffmpeg -y -v error -i "$T" -af "volume=$6dB,aresample=176400,alimiter=limit=0.80:attack=2:release=60:level=disabled,aresample=44100" -c:a libvorbis -q:a 6 "$2"
  rm -f "$T"
  ffmpeg -hide_banner -i "$2" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -e "I:" -e "Peak:"
}
proc "$1" $RAW/azan.ogg 7.6 323.2 "afftdn=nr=8:nf=-60,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=2:attack=20:release=300" ${GAIN:-8.4} 90
