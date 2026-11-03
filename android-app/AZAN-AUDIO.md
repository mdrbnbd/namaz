# আযানের অডিও — উৎস ও লাইসেন্স (v1.1.0)

অ্যাপ প্রতি ওয়াক্তে (অ্যাপ বন্ধ/ফোন লক থাকলেও) AlarmManager → AzanReceiver → AzanService দিয়ে **পুরো আযান** বাজায় —
নোটিফিকেশন চ্যানেলের নিজস্ব কোনো শব্দ নেই (`setSound(null)`), তাই কখনো ছোট/ডিফল্ট নোটিফিকেশন টোন বাজে না।
ফজরে `azan_fajr.ogg`, বাকি চার ওয়াক্তে `azan.ogg`। অডিও বাজে ALARM স্ট্রিমে; বাজার সময় অ্যালার্ম ভলিউম সর্বোচ্চ করা হয়
এবং শেষে আগের ভলিউমে ফিরিয়ে দেওয়া হয়। ফোন সাইলেন্ট/ভাইব্রেট মোডে থাকলে শুধু নোটিফিকেশন আসে।

## মূল আযান — `android/app/src/main/res/raw/azan.ogg` (রবিনের বাছাই: ডেমো #১১)

- মূল ফাইল: **"Time of Adhan, Great Mosque of Mecca - Jan 6, 2018 .webm"** — মসজিদুল হারাম, মক্কা, ৬ জানুয়ারি ২০১৮
  https://commons.wikimedia.org/wiki/File:Time_of_Adhan,_Great_Mosque_of_Mecca_-_Jan_6,_2018_.webm
- রেকর্ড: **M SOHAIL Ahmad**, via Wikimedia Commons
- লাইসেন্স: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/
- পরিবর্তন: পুরো রেকর্ডিং (০:০০–৩:০৯, ১২টি বাক্যের সম্পূর্ণ আযান), ভিডিও বাদ, মনো; high-pass 100 Hz, FFT নয়েজ রিডাকশন (afftdn nr 14 dB),
  250 Hz −2.5 dB / 3 kHz +3 dB (স্পষ্টতা), হালকা কম্প্রেশন (2:1), ৪x oversampled limiter, ০.৩ s fade-in / ১.২ s fade-out,
  Ogg Vorbis q6, 44.1 kHz।
- মাপ: integrated loudness **−12.1 LUFS**, true peak **−1.3 dBTP**, LRA 10.5 LU, দৈর্ঘ্য ১৮৯.২ s, ≈ ১.৯ MB।

## ফজরের আযান — `android/app/src/main/res/raw/azan_fajr.ogg` (ডেমো #৬)

- মূল ফাইল: **"Eid al-Fitr Fajr azan at Malmö Mosque - 19 August 2012.webm"** — “আস-সালাতু খাইরুম মিনান নাওম” সহ (≈ ৩:০৪–৩:২৭)
  https://commons.wikimedia.org/wiki/File:Eid_al-Fitr_Fajr_azan_at_Malm%C3%B6_Mosque_-_19_August_2012.webm
- রেকর্ড: **Islamic Center Malmö**, via Wikimedia Commons
- লাইসেন্স: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/
- কেন এটি: তিনটি ফজর-লাইনযুক্ত রেকর্ডিংয়ের (#৬ মালমো, #১২ কাশ, #১৪ মারাকেশ) মধ্যে কণ্ঠ বনাম পটভূমি-শব্দের পার্থক্য সবচেয়ে বেশি
  (≈ ৩৪ dB; #১২ ≈ ২৩ dB, #১৪ ≈ ১১ dB) — সবচেয়ে পরিষ্কার।
- পরিবর্তন: ০:০০–৩:৫৫ (আযান শেষে দোয়ার অংশ বাদ), মনো; high-pass 90 Hz, afftdn nr 10 dB, 250 Hz −2 dB / 3 kHz +2.5 dB,
  কম্প্রেশন 2.5:1, ৪x oversampled limiter, fade-in/out, Ogg Vorbis q6।
- মাপ: **−12.0 LUFS**, true peak **−1.5 dBTP**, LRA 8.9 LU, দৈর্ঘ্য ২৩৫.০ s, ≈ ২.৬ MB।

অ্যাপের ভিতরে ফুটারে একই ক্রেডিট দেখানো হয় (index.html)।
সতর্কতা: রেকর্ডিংগুলোর লাইসেন্স রেকর্ডকারীর দেওয়া; মুয়াজ্জিনের পারফর্মার-অধিকার আলাদাভাবে যাচাই করা নয়।
