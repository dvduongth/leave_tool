// Prisma 7's prisma-client generator does not create an index.ts barrel.
// This script creates one so code can import from "@/generated/prisma".
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "src", "generated", "prisma");
const file = path.join(dir, "index.ts");

if (!fs.existsSync(dir)) {
  console.error(`[create-prisma-barrel] ${dir} does not exist. Run 'prisma generate' first.`);
  process.exit(1);
}

const content = `export * from "./client";\nexport * from "./enums";\n`;
fs.writeFileSync(file, content, "utf8");
console.log(`[create-prisma-barrel] wrote ${file}`);
