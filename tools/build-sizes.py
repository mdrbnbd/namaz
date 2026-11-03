"""Approximate offline-download sizes per surah per reciter (everyayah.com).
Alafasy: exact (HEAD every ayah). Others: sampled every 10th ayah, scaled by the ratio to Alafasy."""
import json, urllib.request, concurrent.futures as cf, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = json.load(open(f'{ROOT}/data/quran/index.json'))['surahs']
REC = {'ar.alafasy': 'Alafasy_128kbps', 'ar.husary': 'Husary_128kbps', 'ar.minshawi': 'Minshawy_Murattal_128kbps',
       'ar.mahermuaiqly': 'MaherAlMuaiqly128kbps', 'ar.abdurrahmaansudais': 'Abdurrahmaan_As-Sudais_64kbps', 'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_64kbps'}
def head(f, n, a):
    for _ in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f'https://everyayah.com/data/{f}/{n:03d}{a:03d}.mp3', method='HEAD'), timeout=30)
            return int(r.headers['Content-Length'])
        except Exception: pass
    return None
ay = [(s['n'], a) for s in S for a in range(1, s['c'] + 1)]
with cf.ThreadPoolExecutor(16) as ex:
    base = dict(zip(ay, ex.map(lambda x: head(REC['ar.alafasy'], *x), ay)))
    out = {'ar.alafasy': [sum(base[(s['n'], a)] or 0 for a in range(1, s['c'] + 1)) for s in S]}
    samp = ay[::10]
    for rid, f in REC.items():
        if rid == 'ar.alafasy': continue
        v = list(ex.map(lambda x: head(f, *x), samp))
        num = sum(x for x, k in zip(v, samp) if x and base[k]); den = sum(base[k] for x, k in zip(v, samp) if x and base[k])
        out[rid] = [round(b * num / den) for b in out['ar.alafasy']]
        print(rid, round(num / den, 3), flush=True)
json.dump({'note': 'approx bytes per surah (index 0 = surah 1)', 'sizes': out}, open(f'{ROOT}/data/quran/sizes.json', 'w'), separators=(',', ':'))
print({k: round(sum(v) / 1e6) for k, v in out.items()})
