import { chromium } from "playwright";
const [url, pattern, before = "2", after = "4"] = process.argv.slice(2);
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
await ctx.route("**/*", (r) => (["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue()));
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(350); }
const lines = (await page.evaluate(() => document.body.innerText)).split("\n").map((l) => l.trim()).filter(Boolean);
const re = new RegExp(pattern, "i");
let shown = 0;
lines.forEach((l, i) => { if (re.test(l) && shown < 3) { shown++; console.log("-----"); console.log(lines.slice(Math.max(0, i - Number(before)), i + Number(after)).join("\n")); } });
console.log("=== total lines:", lines.length, " | lines containing 19.99:", lines.filter((l) => /19\.99/.test(l)).length);
await b.close();
