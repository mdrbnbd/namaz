# নামাজের সময়সূচি ও হাদিস

লাইভ: https://dfaster.com/namaz/

বাংলাদেশের ৬৪ জেলার নামাজের সময়সূচি, ওয়াক্তের বিস্তারিত, রাকাত সংখ্যা, সেহরি-ইফতার, নিষিদ্ধ সময়, মাসিক সময়সূচি এবং সালাত বিষয়ক হাদিস — একটি স্ট্যাটিক, মোবাইল-ফার্স্ট PWA।

- নামাজের সময়: [Aladhan API](https://aladhan.com/prayer-times-api), method 1 (University of Islamic Sciences, Karachi), আসর হানাফী (school=1) / শাফেয়ী (school=0)।
- হাদিস: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) — `ben-bukhari`, `ara-bukhari`, `ben-muslim`, `ara-muslim` সংস্করণ থেকে সালাত-সংক্রান্ত অধ্যায়ের হাদিস হুবহু নেওয়া। `python3 tools/build-hadith.py` চালিয়ে `data/hadith-salah.json` নতুন করে তৈরি করা যায়।
- হিজরি তারিখ: ব্রাউজারের Umm al-Qura ক্যালেন্ডার, বাংলাদেশের জন্য ডিফল্ট −১ দিন (তারিখে চাপ দিয়ে বদলানো যায়)। বাংলা তারিখ: সংশোধিত বঙ্গাব্দ (২০১৯)।


## আল-কুরআন (v4)
- ১১৪ সূরা, আরবি (উসমানী রসম) — [api.alquran.cloud](https://alquran.cloud/api) `quran-uthmani` (Tanzil)
- বাংলা অনুবাদ — **মাওলানা মুহিউদ্দীন খান**, api.alquran.cloud `bn.bengali`
- সূরার নামের বাংলা অর্থ — [api.quran.com](https://api.quran.com/api/v4/chapters?language=bn)
- টেক্সট `data/quran/*.json`-এ হুবহু রাখা (তৈরি: `tools/build-quran.py`); অডিও [everyayah.com](https://everyayah.com) থেকে আয়াতভিত্তিক স্ট্রিম (ডিফল্ট ক্বারী: মিশারি রাশিদ আল-আফাসি), চাইলে সূরা ধরে অফলাইনে সংরক্ষণ।

## নিচের মেনু ও অফলাইন ডাউনলোড (v5)
- নিচে স্থায়ী মেনু: পেছনে · হোম · কুরআন · হাদিস · সূরা গাইড · ডাউনলোড; ফোনের ব্যাক বাটন/জেসচার ট্যাব ও সূরা রিডারের ইতিহাস ধরে পেছনে যায়।
- **ডাউনলোড** (`offline.js`): ক্বারী অনুযায়ী প্রতিটি সূরা বা পুরো কুরআন (আকারের আগাম সতর্কতা সহ) — বিরতি/চালু/বাতিল, অ্যাপ বন্ধ হলে পরে যেখানে থেমেছিল সেখান থেকে চলে। Android অ্যাপে ফাইল থাকে Capacitor Filesystem-এর অ্যাপ-নিজস্ব Data ফোল্ডারে (ফোন নিজে মুছে না); ব্রাউজারে Cache API + `navigator.storage.persist()`। ডাউনলোড করা সূরা ইন্টারনেট ছাড়াই বাজে।
- আনুমানিক আকার `data/quran/sizes.json` (তৈরি: `tools/build-sizes.py`; আফাসি সঠিক, বাকিরা নমুনা থেকে আনুমানিক)।

## কোন ওয়াক্তে কোন সূরা
- `data/surah-guide.json` (তৈরি: `tools/build-guide.py`) — প্রতিটি আমলের হাদিস নম্বরসহ fawazahmed0/hadith-api থেকে যাচাই করা, হাদিসের মূল বাংলা ও আরবি পাঠ হুবহু।
- বাদ দেওয়া হয়েছে: তিরমিযী ২৮৯২ (ঘুমের আগে সাজদা ও মুলক — যঈফ), জুমুআর দিনে সূরা কাহফ ও প্রতি সালাতের পর আয়াতুল কুরসি (উৎস-ডেটায় হাদিসটি পাওয়া যায়নি)।

## Android অ্যাপ (`android-app/`)
- Capacitor — পুরো সাইট (হাদিস ও কুরআনের টেক্সটসহ) অ্যাপের ভেতরে বান্ডেল করা; কোনো ডোমেইনের উপর নির্ভর করে না। নামাজের সময় Aladhan API ও তিলাওয়াতের অডিও everyayah.com থেকে আসে।
- নেটিভ আযান: AlarmManager exact alarm → foreground service (mediaPlayback) পুরো আযান বাজায়; রিবুট/সময় পরিবর্তনে আবার সেট হয়। অ্যাপ খুললে পরের ১৪ দিনের ৫ ওয়াক্ত সেট হয়।
- আযানের অডিও: CC0 — বিস্তারিত [android-app/AZAN-AUDIO.md](android-app/AZAN-AUDIO.md)
- বিল্ড: `cd android-app && npm ci && ./sync-web.sh && npx cap sync android && cd android && ./gradlew assembleRelease bundleRelease` (সাইনিং কী রিপোজিটরিতে নেই)।
- ডাউনলোড: [GitHub Releases](https://github.com/mdrbnbd/namaz/releases/latest)
