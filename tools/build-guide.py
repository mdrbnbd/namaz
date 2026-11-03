#!/usr/bin/env python3
"""Build data/surah-guide.json: 'which surah in which waqt' items, each backed by a hadith
whose Bangla/Arabic text is copied verbatim from fawazahmed0/hadith-api. Items are listed by
hadith-api 'hadithnumber' (the sequence number in the edition files) and were located by
searching the English editions; anything that could not be found there was left out.
Dropped: Tirmidhi 2892 (Sajdah+Mulk before sleep) - graded Daif in the source data."""
import json, os, urllib.request, re
CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/"
def load(ed):
    p = f"/tmp/{ed}.json"
    if not os.path.exists(p): urllib.request.urlretrieve(CDN + ed + ".min.json", p)
    return {h["hadithnumber"]: h for h in json.load(open(p, encoding="utf-8"))["hadiths"]}
NAMES = {"bukhari": "সহীহ বুখারী", "muslim": "সহীহ মুসলিম", "abudawud": "সুনান আবু দাউদ", "tirmidhi": "জামে আত-তিরমিযী", "nasai": "সুনান আন-নাসাঈ"}
# (group, title, when, surahs [[surah, ayahFrom?, ayahTo?]], [(collection, hadithnumber)])
ITEMS = [
 ("must", "প্রতি রাকাতে সূরা ফাতিহা", "প্রত্যেক সালাতের প্রত্যেক রাকাতে", [[1]], [("bukhari", 756)]),
 ("fajr", "ফজরের দুই রাকাত সুন্নাত", "ফজরের ফরজের আগে", [[109], [112]], [("muslim", 1690)]),
 ("fajr", "শুক্রবার ফজরের ফরজ", "জুমুআর দিন ফজর", [[32], [76]], [("bukhari", 891), ("muslim", 2034)]),
 ("jumuah", "জুমুআ ও দুই ঈদের সালাত", "জুমুআ / ঈদ", [[87], [88]], [("muslim", 2028)]),
 ("jumuah", "জুমুআর সালাত", "জুমুআ", [[62], [63]], [("muslim", 2026)]),
 ("maghrib", "মাগরিবে সূরা আত-তূর", "মাগরিব", [[52]], [("bukhari", 765)]),
 ("maghrib", "মাগরিবে সূরা আল-মুরসালাত", "মাগরিব", [[77]], [("bukhari", 4429)]),
 ("isha", "এশায় সূরা আত-তীন", "এশা", [[95]], [("bukhari", 769)]),
 ("witr", "বিতরের তিন রাকাত", "এশার পর বিতর", [[87], [109], [112]], [("abudawud", 1423), ("tirmidhi", 462)]),
 ("after", "প্রতি সালাতের পর মুআওয়িযাত", "প্রত্যেক ফরজ সালাতের পর", [[112], [113], [114]], [("abudawud", 1523), ("tirmidhi", 2903)]),
 ("night", "সূরা মুলকের ফযীলত", "যেকোনো সময় (বিশেষত রাতে)", [[67]], [("tirmidhi", 2891)]),
 ("night", "ঘুমানোর আগে আয়াতুল কুরসি", "রাতে বিছানায় যাওয়ার সময়", [[2, 255, 255]], [("bukhari", 2311)]),
 ("night", "রাতে সূরা বাকারার শেষ দুই আয়াত", "রাতে", [[2, 285, 286]], [("bukhari", 5009)]),
 ("night", "ঘুমানোর আগে ইখলাস, ফালাক ও নাস", "প্রতি রাতে বিছানায় যাওয়ার সময়", [[112], [113], [114]], [("bukhari", 5017)]),
 ("other", "সূরা কাহফের প্রথম দশ আয়াত মুখস্থ", "যেকোনো সময় (দাজ্জালের ফিতনা থেকে সুরক্ষা)", [[18, 1, 10]], [("muslim", 1883)]),
]
out = []
for g, title, when, surahs, refs in ITEMS:
    rs = []
    for col, n in refs:
        bn = load("ben-" + col)[n]; ar = load("ara-" + col).get(n, {}); en = load("eng-" + col)[n]
        grades = [f'{x.get("name","")}: {x.get("grade","")}' for x in (bn.get("grades") or en.get("grades") or [])][:2]
        rs.append({"c": col, "cn": NAMES[col], "n": n, "an": str(bn.get("arabicnumber", n)),
                   "bn": re.sub("\u00ad", "", bn["text"]).strip(), "ar": (ar.get("text") or "").strip(), "en": en["text"][:400], "grades": grades})
        assert rs[-1]["bn"], (col, n)
    out.append({"g": g, "title": title, "when": when, "surahs": surahs, "refs": rs})
json.dump({"source": "fawazahmed0/hadith-api@1", "items": out}, open("data/surah-guide.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
for x in out:
    print(x["title"], [(r["cn"], r["an"], r["grades"]) for r in x["refs"]], "|", x["refs"][0]["en"][:90].replace("\n"," "))
