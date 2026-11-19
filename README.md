# 貓咪一天吃多少？每日餵食量計算器

**網頁：https://chen-mouchin.github.io/cat-feeding-calculator/**

輸入貓的體重、生活階段（成貓、幼貓、減重）和包裝上的熱量，算出：

- 一天大約幾大卡。一律顯示範圍，並列歐洲寵物食品工業聯合會（FEDIAF）和世界小動物獸醫協會（WSAVA）的算法；減重時用美國動物醫院協會（AAHA）的公式。
- 換成乾糧幾克、罐頭幾罐、一餐多少；乾濕混餵時可以用滑桿分配。
- 零食最多能佔多少熱量。

每個數字都可以展開「怎麼算的」；綠色編號點了會顯示英文原句與頁碼。全部在瀏覽器裡計算，不送出任何資料。

這是[貓健康站](https://cathealthtw.com/)的互動工具，也是生成式 AI 課程「Vibe Coding 互動網頁」作業的重做版。

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 整個工具（單一檔案，CSS、JS 內嵌） |
| `SPEC.md` | 規格書：問題、範圍、輸入、公式與出處、畫面、驗收 |
| `DEVLOG.md` | 開發紀錄：每一輪改了什麼、為什麼、怎麼驗證 |
| `runs/` | 每次檢查與獨立審查的原始紀錄 |
| `AGENTS.md`、`CLAUDE.md` | 給 AI 的規則 |
| `tests/test_calc.mjs` | 計算的單元測試 |
| `scripts/check_claims.py` | 檢查每條出處的英文原句真的在原文那一頁 |

## 檢查

```
node tests/test_calc.mjs
python scripts/check_claims.py <原文逐頁文字資料夾>
```

原文 PDF 有著作權，不放在這個 repo；出處清單在 `index.html` 的 `<script id="claims">`，照網址可以下載原文。

## 限制

公式只能預測一群貓的平均，結果是起點，要看體態再調整。這個工具不提供診斷；減重的理想體重請和獸醫討論。
