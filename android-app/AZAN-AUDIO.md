# আযানের অডিও — উৎস ও লাইসেন্স

`android/app/src/main/res/raw/azan.ogg`

- মূল ফাইল: **"Beautiful adhan.ogg"** — Wikimedia Commons
  https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg
- রেকর্ড/আপলোড: Adam-synagda (own work)
- লাইসেন্স: **CC0 1.0 — Public Domain Dedication** (https://creativecommons.org/publicdomain/zero/1.0/)
- পরিবর্তন: মনো করা হয়েছে, শেষ ৩ সেকেন্ড fade-out, Ogg Vorbis q3 (≈ ১৫৪ সেকেন্ড, ≈ ৮২০ KB)।
  `ffmpeg -i Beautiful_adhan.ogg -ac 1 -af "afade=t=out:st=151:d=3" -c:a libvorbis -q:a 3 azan.ogg`
- ফজরের জন্য আলাদা (“আস-সালাতু খাইরুম মিনান নাওম” সহ) কোনো মুক্ত-লাইসেন্সের যাচাইকৃত রেকর্ডিং পাওয়া যায়নি, তাই সব ওয়াক্তে একই আযান বাজে।
