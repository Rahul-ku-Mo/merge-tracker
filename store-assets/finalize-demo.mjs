// Copies the chrome stub next to the built demo pages and points them at it relatively.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = join(root, "site/demo");
copyFileSync(join(root, "store-assets/chrome-stub.js"), join(demo, "chrome-stub.js"));
for (const page of ["popup", "options"]) {
  const file = join(demo, `src/${page}/${page}.html`);
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace('src="/store-assets/chrome-stub.js"', 'src="../../chrome-stub.js"')
  );
}
console.log("demo ready: site/demo");
