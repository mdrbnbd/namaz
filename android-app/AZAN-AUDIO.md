# আযানের অডিও — উৎস ও লাইসেন্স

`android/app/src/main/res/raw/azan.ogg`

- মূল ফাইল: **"Beautiful adhan.ogg"** — Wikimedia Commons
  https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg
- রেকর্ড/আপলোড: Adam-synagda (own work)
- লাইসেন্স: **CC0 1.0 — Public Domain Dedication** (https://creativecommons.org/publicdomain/zero/1.0/)
- পরিবর্তন: মনো করা হয়েছে, শেষ ৩ সেকেন্ড fade-out, Ogg Vorbis q3 (≈ ১৫৪ সেকেন্ড, ≈ ৮২০ KB)।
  `ffmpeg -i Beautiful_adhan.ogg -ac 1 -af "afade=t=out:st=151:d=3" -c:a libvorbis -q:a 3 azan.ogg`

## ফজরের আলাদা আযান — `android/app/src/main/res/raw/azan_fajr.ogg`

অ্যাপ ফজরের ওয়াক্তে `azan_fajr.ogg` বাজায় (বাকি চার ওয়াক্তে `azan.ogg`)। জাভাস্ক্রিপ্ট থেকে প্রতিটি আযানের সাথে `sound: "fajr" | "azan"` যায় →
AzanScheduler → AzanReceiver → AzanService। এখন পর্যন্ত `azan_fajr.ogg` হলো `azan.ogg`-এরই কপি (placeholder) —
v1.1-এ রবিনের বেছে নেওয়া ফজরের আযান (“আস-সালাতু খাইরুম মিনান নাওম” সহ) দিয়ে বদলানো হবে এবং এখানে উৎস/লাইসেন্স লেখা হবে।
