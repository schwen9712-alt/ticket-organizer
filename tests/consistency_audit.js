const src = require("fs").readFileSync("index.html", "utf8");
const setOf = (re) => new Set([...src.match(re)[1].matchAll(/[A-Z]{3}/g)].map(m => m[0]));
const A = setOf(/const US_AIRPORTS = new Set\(\[([\s\S]*?)\]\)/), B = setOf(/const _US_APTS = new Set\(\[([\s\S]*?)\]\)/);
const usOk = A.size === B.size && [...A].every(x => B.has(x));
const fcs = [...src.matchAll(/fareClassByAirline:\s*\{([\s\S]*?)\n\s*\},?\n/g)].map(m => m[1].replace(/\/\/[^\n]*/g, "").replace(/\s+/g, ""));
const fcOk = fcs.length === 2 && fcs[0] === fcs[1];
console.log("US 双表一致=" + (usOk ? "✓" : "✗ " + A.size + "/" + B.size) + " · 舱位双表一致=" + (fcOk ? "✓" : "✗ (" + fcs.length + " 份" + (fcs.length === 2 ? ", 内容不同" : "") + ")"));
if (!usOk || !fcOk) process.exit(1);
