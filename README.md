# নামাজের সময়সূচি ও হাদিস

লাইভ: https://dfaster.com/namaz/

বাংলাদেশের ৬৪ জেলার নামাজের সময়সূচি, ওয়াক্তের বিস্তারিত, রাকাত সংখ্যা, সেহরি-ইফতার, নিষিদ্ধ সময়, মাসিক সময়সূচি এবং সালাত বিষয়ক হাদিস — একটি স্ট্যাটিক, মোবাইল-ফার্স্ট PWA।

- নামাজের সময়: [Aladhan API](https://aladhan.com/prayer-times-api), method 1 (University of Islamic Sciences, Karachi), আসর হানাফী (school=1) / শাফেয়ী (school=0)।
- হাদিস: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) — `ben-bukhari`, `ara-bukhari`, `ben-muslim`, `ara-muslim` সংস্করণ থেকে সালাত-সংক্রান্ত অধ্যায়ের হাদিস হুবহু নেওয়া। `python3 tools/build-hadith.py` চালিয়ে `data/hadith-salah.json` নতুন করে তৈরি করা যায়।
- হিজরি তারিখ: ব্রাউজারের Umm al-Qura ক্যালেন্ডার, বাংলাদেশের জন্য ডিফল্ট −১ দিন (তারিখে চাপ দিয়ে বদলানো যায়)। বাংলা তারিখ: সংশোধিত বঙ্গাব্দ (২০১৯)।
