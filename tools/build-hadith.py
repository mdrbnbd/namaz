#!/usr/bin/env python3
"""Build data/hadith-salah.json from fawazahmed0/hadith-api (jsDelivr).
Hadith text is taken verbatim from the source editions; nothing is written by hand.
Usage: python3 tools/build-hadith.py"""
import json, urllib.request, re, os
CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/"
CACHE = "/tmp"
def load(ed):
    p = os.path.join(CACHE, ed + ".json")
    if not os.path.exists(p):
        urllib.request.urlretrieve(CDN + ed + ".min.json", p)
    return json.load(open(p, encoding="utf-8"))

# collection -> {section number: Bangla category label}
PLAN = {
  "bukhari": ("সহীহ বুখারী", {8:"সালাত",9:"সালাতের ওয়াক্ত",10:"আযান ও জামাআত",11:"জুমুআ",12:"ভয়কালীন সালাত",13:"দুই ঈদ",14:"বিতর",15:"ইসতিসকা",16:"সূর্যগ্রহণ",17:"তিলাওয়াতের সিজদা",18:"কসর (সফরের সালাত)",19:"তাহাজ্জুদ",20:"মসজিদের ফযীলত",21:"সালাতে করণীয়",22:"সাহু সিজদা",31:"তারাবীহ"}),
  "muslim":  ("সহীহ মুসলিম", {4:"সালাত",5:"মসজিদ ও সালাতের স্থান",6:"মুসাফির ও নফল সালাত",7:"জুমুআ",8:"দুই ঈদ"}),
}
MIN, MAX = 90, 750
out = []
for col, (bn_name, secs) in PLAN.items():
    ben = load("ben-" + col); ara = load("ara-" + col)
    arabic = {h["hadithnumber"]: h["text"] for h in ara["hadiths"]}
    for h in ben["hadiths"]:
        s = h["reference"]["book"]
        if s not in secs: continue
        t = re.sub(r"[\u00ad]", "", (h["text"] or "")).strip()
        if not (MIN <= len(t) <= MAX): continue
        # skip bare "same chain / similar hadith" cross-references
        if re.search(r"অনুরূপ|একই সান[াা]দে|একই সনদে|উপরোক্ত হাদীস", t) and len(t) < 260: continue
        a = re.sub(r"[\u00ad]", "", arabic.get(h["hadithnumber"], "") or "").strip()
        n = h["hadithnumber"]
        out.append({"c": col, "n": n if isinstance(n, int) or not float(n).is_integer() else int(n),
                    "an": str(h.get("arabicnumber", "")), "s": s, "cat": secs[s], "bn": t, "ar": a})
cats = {}
for x in out: cats.setdefault(x["cat"], 0); cats[x["cat"]] += 1
# Hadith-of-the-day pool: sayings of the Prophet (contains "বলেছেন"/"বলেন") about salah
pool = [i for i, x in enumerate(out) if ("সালাত" in x["bn"] or "নামায" in x["bn"])
        and re.search(r"(রাসূল|রসূল|নবী).{0,80}(বলেছেন|বলতে শুনেছি|ইরশাদ)", x["bn"]) and 150 <= len(x["bn"]) <= 600]
data = {"source": "fawazahmed0/hadith-api@1 (ben-bukhari, ara-bukhari, ben-muslim, ara-muslim)",
        "collections": {k: v[0] for k, v in PLAN.items()}, "daily": pool, "hadith": out}
json.dump(data, open("data/hadith-salah.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "hadith;", len(pool), "daily;", cats)
