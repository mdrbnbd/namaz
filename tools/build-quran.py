#!/usr/bin/env python3
"""Build data/quran/index.json and data/quran/<n>.json from api.alquran.cloud
(quran-uthmani Arabic + bn.bengali, Bangla translation by Muhiuddin Khan) and the Bangla
meaning of each surah name from api.quran.com (chapters?language=bn). Text is verbatim."""
import json, os, urllib.request
def get(url, cache):
    p = "/tmp/" + cache
    if not os.path.exists(p): urllib.request.urlretrieve(url, p)
    return json.load(open(p, encoding="utf-8"))
ar = get("https://api.alquran.cloud/v1/quran/quran-uthmani", "q-ar.json")["data"]["surahs"]
bn = get("https://api.alquran.cloud/v1/quran/bn.bengali", "q-bn.json")["data"]["surahs"]
qc = get("https://api.quran.com/api/v4/chapters?language=bn", "qc-ch.json")["chapters"]
# Bangla transliteration of surah names (common Bangladeshi spelling)
BN_NAMES = "আল-ফাতিহা|আল-বাকারা|আলে ইমরান|আন-নিসা|আল-মায়িদা|আল-আনআম|আল-আরাফ|আল-আনফাল|আত-তাওবা|ইউনুস|হুদ|ইউসুফ|আর-রাদ|ইবরাহীম|আল-হিজর|আন-নাহল|বনী ইসরাঈল|আল-কাহফ|মারইয়াম|ত্বা-হা|আল-আম্বিয়া|আল-হাজ্জ|আল-মুমিনূন|আন-নূর|আল-ফুরকান|আশ-শুআরা|আন-নামল|আল-কাসাস|আল-আনকাবূত|আর-রূম|লুকমান|আস-সাজদা|আল-আহযাব|সাবা|ফাতির|ইয়াসীন|আস-সাফফাত|সোয়াদ|আয-যুমার|আল-মুমিন|হা-মীম সাজদা|আশ-শূরা|আয-যুখরুফ|আদ-দুখান|আল-জাসিয়া|আল-আহকাফ|মুহাম্মাদ|আল-ফাতহ|আল-হুজুরাত|কাফ|আয-যারিয়াত|আত-তূর|আন-নাজম|আল-কামার|আর-রাহমান|আল-ওয়াকিয়া|আল-হাদীদ|আল-মুজাদালা|আল-হাশর|আল-মুমতাহিনা|আস-সফ|আল-জুমুআ|আল-মুনাফিকূন|আত-তাগাবুন|আত-তালাক|আত-তাহরীম|আল-মুলক|আল-কলম|আল-হাক্কা|আল-মাআরিজ|নূহ|আল-জিন|আল-মুযযাম্মিল|আল-মুদ্দাসসির|আল-কিয়ামাহ|আদ-দাহর (আল-ইনসান)|আল-মুরসালাত|আন-নাবা|আন-নাযিআত|আবাসা|আত-তাকভীর|আল-ইনফিতার|আল-মুতাফফিফীন|আল-ইনশিকাক|আল-বুরূজ|আত-তারিক|আল-আলা|আল-গাশিয়া|আল-ফাজর|আল-বালাদ|আশ-শামস|আল-লাইল|আদ-দুহা|আল-ইনশিরাহ|আত-তীন|আল-আলাক|আল-কদর|আল-বাইয়্যিনাহ|আয-যিলযাল|আল-আদিয়াত|আল-কারিআ|আত-তাকাসুর|আল-আসর|আল-হুমাযা|আল-ফীল|কুরাইশ|আল-মাউন|আল-কাউসার|আল-কাফিরূন|আন-নাসর|আল-লাহাব|আল-ইখলাস|আল-ফালাক|আন-নাস".split("|")
assert len(BN_NAMES) == 114
BISM = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
index = []
for s, t, c in zip(ar, bn, qc):
    n = s["number"]; assert t["number"] == n == c["id"] and len(s["ayahs"]) == len(t["ayahs"])
    ayahs = []
    for i, (a, b) in enumerate(zip(s["ayahs"], t["ayahs"])):
        txt = a["text"].replace("\ufeff", "").strip()
        if i == 0 and n not in (1, 9):
            w = txt.split(" ")
            if "".join(ch for ch in w[0] if "\u0621" <= ch <= "\u064a") == "بسم" and len(w) > 4:
                txt = " ".join(w[4:])  # basmala is shown separately as the surah header
        ayahs.append([txt, b["text"].strip(), 1 if a.get("sajda") else 0])
    json.dump({"n": n, "g": s["ayahs"][0]["number"], "a": ayahs}, open(f"data/quran/{n}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    index.append({"n": n, "bn": BN_NAMES[n - 1], "ar": s["name"].replace("سُورَةُ ", ""), "en": s["englishName"], "m": c["translated_name"]["name"],
                  "c": len(s["ayahs"]), "p": "মাক্কী" if s["revelationType"] == "Meccan" else "মাদানী", "g": s["ayahs"][0]["number"]})
json.dump({"translation": "মুহিউদ্দীন খান (bn.bengali)", "arabic": "quran-uthmani", "source": "api.alquran.cloud; surah name meanings: api.quran.com", "surahs": index},
          open("data/quran/index.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(index), "surahs,", sum(x["c"] for x in index), "ayahs")
