// 計算核心的單元測試：從 index.html 取出 <script id="calc"> 那一段執行，不另外複製一份程式。
// 用法：node tests/test_calc.mjs
// 前四組數字和貓健康站既有計算程式的測試相同（SPEC.md 第 9 節驗收 1–4）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const code = html.match(/<script id="calc">([\s\S]*?)<\/script>/)[1];
const ctx = { module: { exports: {} } };
vm.runInNewContext(code, ctx);
const Calc = ctx.module.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`PASS  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const row = (e, key) => e.rows.find((r) => r.key === key);

t("驗收 1：4 公斤結紮或室內，FEDIAF 132–190、WSAVA 226–253", () => {
  const e = Calc.energy({ weightKg: 4, stage: "adult", activity: "indoor" });
  assert.deepEqual([row(e, "fediaf-indoor").low, row(e, "fediaf-indoor").high], [132, 190]);
  assert.deepEqual([row(e, "wsava").low, row(e, "wsava").high], [226, 253]);
});

t("驗收 2：目標 4 公斤減重，RER 198、減重 158（70 × 4^0.75）", () => {
  const e = Calc.energy({ weightKg: 5, stage: "adult", activity: "indoor", targetKg: 4 });
  assert.equal(row(e, "aaha-loss").rer, 198);
  assert.equal(row(e, "aaha-loss").low, 158);
});

t("驗收 3：2 公斤、3.9 個月幼貓，倍數 2.0–2.5", () => {
  const mw = Math.pow(2, 0.67);
  const e = Calc.energy({ weightKg: 2, stage: "kitten", ageMonths: 3.9 });
  const r = row(e, "fediaf-kitten");
  assert.deepEqual([...r.times], [2.0, 2.5]);
  assert.equal(r.low, Math.round(200 * mw));
  assert.equal(r.high, Math.round(250 * mw));
  assert.equal(row(e, "wsava"), undefined);   // WSAVA 範圍只給成貓
});

t("驗收 4：200 大卡、每 100 克 375.6 大卡 → 53 克", () => {
  assert.equal(Calc.grams(200, 375.6), 53);
});

t("幼貓月齡分段的邊界：4、9、12 個月", () => {
  const times = (m) => [...row(Calc.energy({ weightKg: 3, stage: "kitten", ageMonths: m }), "fediaf-kitten").times];
  assert.deepEqual(times(3.99), [2.0, 2.5]);
  assert.deepEqual(times(4), [1.75, 2.0]);
  assert.deepEqual(times(8.9), [1.75, 2.0]);
  assert.deepEqual(times(9), [1.5, 1.5]);
  assert.equal(Calc.energy({ weightKg: 3, stage: "kitten", ageMonths: 12 }).need, "adult");
  assert.equal(Calc.energy({ weightKg: 3, stage: "kitten", ageMonths: "" }).need, "age");
  assert.equal(Calc.energy({ weightKg: 3, stage: "kitten", ageMonths: "  " }).need, "age");   // 審查 #28：空白不當成 0 個月
});

t("活動量大：FEDIAF 100 × 體重^0.67，上下限相同", () => {
  const r = row(Calc.energy({ weightKg: 4, stage: "adult", activity: "active" }), "fediaf-active");
  assert.equal(r.low, Math.round(100 * Math.pow(4, 0.67)));
  assert.equal(r.low, r.high);
});

t("輸入檢查：體重範圍、目標體重要比目前輕", () => {
  assert.equal(Calc.energy({ weightKg: 0 }).need, "weight");
  assert.equal(Calc.energy({ weightKg: 20 }).need, "weight");
  assert.equal(Calc.energy({ weightKg: "abc" }).need, "weight");
  assert.equal(Calc.energy({ weightKg: 4, targetKg: 4 }).need, "target");
  assert.equal(Calc.energy({ weightKg: 4, targetKg: 5 }).need, "target");
  assert.equal(Calc.energy({ weightKg: 4, targetKg: "" }).ok, true);   // 沒填目標就不算減重
  assert.equal(Calc.energy({ weightKg: 4, targetKg: " " }).rows.length, 2);
});

t("單位換算：每公斤 ÷ 10 = 每 100 克", () => {
  assert.equal(Calc.per100g(3800, "kg"), 380);
  assert.equal(Calc.per100g(380, "100g"), 380);
  assert.equal(Calc.per100g(0, "kg"), null);
  assert.equal(Calc.per100g("", "kg"), null);
});

t("份量：只有乾糧、只有罐頭、乾濕各半、留 10% 給零食", () => {
  const dry = Calc.portion(200, { dryPer100: 380, wetShare: 0.5, treat: false });
  assert.equal(dry.dryG, 53);
  assert.equal(dry.wetKcal, null);
  const wet = Calc.portion(200, { wetPerCan: 80, wetShare: 0.5, treat: false });
  assert.equal(wet.cans, 2.5);
  assert.equal(wet.dryKcal, null);
  const mix = Calc.portion(200, { dryPer100: 400, wetPerCan: 100, wetShare: 0.5, treat: false });
  assert.equal(mix.wetKcal, 100);
  assert.equal(mix.dryKcal, 100);
  assert.equal(mix.dryG, 25);
  assert.equal(mix.cans, 1);
  const treat = Calc.portion(200, { dryPer100: 400, wetShare: 0, treat: true });
  assert.equal(treat.foodKcal, 180);
  assert.equal(treat.treatKcal, 20);
  assert.equal(treat.dryG, 45);
  assert.equal(treat.foodKcal + treat.treatKcal, 200);   // 零食熱量算進每天的總量
});

t("理想體重估計：FEDIAF 體態表 6 分 +10–15%、7 分 +20–30%、8 分 +30–40%、9 分 +40% 以上", () => {
  const r = Calc.idealWeight(6, 7);              // 超重 20%
  assert.equal(r.high, 5);                        // 6 ÷ 1.2
  assert.equal(r.low, 4.6);                       // 6 ÷ 1.3 = 4.615
  assert.deepEqual([Calc.idealWeight(5, 6).low, Calc.idealWeight(5, 6).high], [4.3, 4.5]);   // 5 ÷ 1.15、5 ÷ 1.1
  assert.deepEqual([Calc.idealWeight(7, 8).low, Calc.idealWeight(7, 8).high], [5, 5.4]);     // 7 ÷ 1.4、7 ÷ 1.3
  const r9 = Calc.idealWeight(6, 9);
  assert.equal(r9.low, null);                     // 9 分沒有上限
  assert.equal(r9.high, 4.3);                     // 6 ÷ 1.4
  assert.equal(Calc.idealWeight(15, 9).high, 10.7);
  assert.equal(Calc.idealWeight(5, 5), null);     // 不超重就不估
  assert.equal(Calc.idealWeight(5, ""), null);
  assert.equal(Calc.idealWeight(0, 7), null);
});

console.log(`\n${pass} 通過，${fail} 失敗`);
process.exit(fail ? 1 : 0);
