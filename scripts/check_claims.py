"""檢查 index.html 裡每條出處：英文原句真的在原文那一頁、中文的數字都出現在原句裡。

原文（PDF 抽出的逐頁文字）有著作權，不放在這個 repo；預設讀 HW10 貓糧 Wiki 的 raw/。
規則和 HW10 的 lint_wiki.py 一樣（忽略大小寫、空白、斷行連字號、連字 ﬁ→fi）。
原文是圖片的（figure: true，例如 AAHA Box 1）程式讀不到，列為 MANUAL，要人工對照 PDF 那一頁。

用法：python scripts/check_claims.py [raw 資料夾]
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent.parent / "HW10" / "cat-food-wiki" / "raw"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("­", "")
    s = re.sub(r"[‘’´`]", "'", s)
    s = re.sub(r"[“”]", '"', s)
    s = re.sub(r"[–—]", "-", s)
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def numbers(s: str) -> set:
    return {float(n) for n in re.findall(r"\d+(?:\.\d+)?", s)}


def pages(key: str) -> dict:
    f = RAW / f"{key}.txt"
    if not f.exists():
        return {}
    t = f.read_text(encoding="utf-8")
    return {int(m.group(1)): norm(m.group(2))
            for m in re.finditer(r"=== p\.(\d+) ===\n(.*?)(?==== p\.|\Z)", t, re.S)}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    data = json.loads(re.search(r'<script id="claims" type="application/json">(.*?)</script>', html, re.S).group(1))
    used = set(re.findall(r"C-[A-Z]+-\d{2}", re.sub(r'<script id="claims".*?</script>', "", html, flags=re.S)))
    fails = manual = 0
    cache = {}
    for cid, c in data["claims"].items():
        if c["src"] not in data["sources"]:
            print(f"FAIL  {cid}：來源 {c['src']} 不在出處清單"); fails += 1; continue
        if c.get("figure"):
            print(f"MANUAL {cid}：{c['src']} p.{c['page']} 是圖片，人工對照"); manual += 1; continue
        pg = cache.setdefault(c["src"], pages(c["src"]))
        if not pg:
            print(f"FAIL  {cid}：找不到原文 {RAW / (c['src'] + '.txt')}"); fails += 1; continue
        q = norm(c["quote"])
        if len(q.split()) < 6 and not re.search(r"\d", q):
            print(f"FAIL  {cid}：原句太短"); fails += 1; continue
        parts = [norm(x) for x in c["quote"].split("…")]   # 用「…」跳過中間不相關的字，各段要依序出現在同一頁
        page_text = pg.get(c["page"], "")
        pos, found = 0, True
        for part in parts:
            k = page_text.find(part, pos)
            if k < 0:
                found = False; break
            pos = k + len(part)
        if not found:
            other = [p for p, t in pg.items() if all(x in t for x in parts)]
            hint = f"（在 p.{other}）" if other else ""
            print(f"FAIL  {cid}：原句不在 p.{c['page']}{hint}"); fails += 1; continue
        extra = numbers(c["zh"]) - numbers(c["quote"])
        if extra:
            print(f"FAIL  {cid}：中文的數字 {sorted(extra)} 不在原句裡"); fails += 1; continue
        print(f"OK    {cid}  {c['src']} p.{c['page']}")
    for cid in sorted(set(data["claims"]) - used):
        print(f"WARN  {cid}：頁面沒有用到");
    for cid in sorted(used - set(data["claims"])):
        print(f"FAIL  {cid}：頁面用到、但出處清單沒有"); fails += 1
    print(f"\n{len(data['claims'])} 條，FAIL {fails}，人工對照 {manual}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
