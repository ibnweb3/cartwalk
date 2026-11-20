#!/usr/bin/env node
// npm run taste: the shortest honest path for someone to see Cartwalk work.
// Starts the bundled broken shop, sends one real Kane shopper through it, shows
// the verdict, and writes an HTML report of the run. The shop is supposed to
// fail (the Desk Lamp cannot be added to the cart), so a FAIL here is the demo
// working. It spends Kane credits and takes usually 3 to 7 minutes.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const port = process.env.PORT || "4180";
const url = `http://localhost:${port}`;
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const logFile = path.join("runs", `taste-${stamp}.jsonl`);
const reportFile = path.join("runs", `taste-${stamp}-report.html`);

async function isUp() {
  try { await fetch(url); return true; } catch { return false; }
}

(async () => {
  const kane = spawnSync("kane-cli --version", { shell: true, encoding: "utf8" });
  if (kane.status !== 0) {
    console.error("Kane CLI was not found. Install it and log in, then run this again:\n  npm install -g @testmuai/kane-cli\n  kane-cli login\n\nNo Kane? `npm run offline` shows the recorded run and the tamper check without it.");
    process.exit(2);
  }
  if (await isUp()) { console.error(`something is already serving ${url}. Stop it, or set PORT=4190 and run again.`); process.exit(2); }

  const store = spawn(process.execPath, [path.join(root, "store", "server.js")], { env: { ...process.env, PORT: port }, stdio: "ignore" });
  const stop = () => { try { store.kill(); } catch { /* already gone */ } };
  process.on("exit", stop);
  for (let i = 0; i < 40 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await isUp())) { stop(); console.error("the demo shop did not start"); process.exit(2); }

  console.log(`Demo shop running at ${url} (two planted mistakes). Sending a Kane shopper; this usually takes 3 to 7 minutes...`);
  const check = spawn(process.execPath, [path.join(root, "bin", "cartwalk.js"), "check", url, "--log", logFile], { stdio: "inherit", cwd: root });
  check.on("close", (code) => {
    stop();
    if (fs.existsSync(path.join(root, logFile))) {
      spawnSync(process.execPath, [path.join(root, "bin", "cartwalk.js"), "report", logFile, "--out", reportFile], { stdio: "ignore", cwd: root });
      console.log(`\nReport: ${reportFile}   (open it in a browser)`);
    }
    if (code === 1) console.log("Result: FAIL, as expected. Cartwalk found the planted bug.");
    else if (code === 0) console.log("Result: PASS. The shopper got through, so it did not hit the planted bug this time; run it again.");
    else console.log("Result: inconclusive. Kane did not finish. Run it again, or use the recorded runs: npm run offline");
    process.exit(code === 2 ? 2 : 0);
  });
})();
