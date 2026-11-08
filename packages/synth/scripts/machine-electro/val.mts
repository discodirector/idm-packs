// Validates the generated pack (pack.ts validatePack) and that it parses as a pure literal (packLiteral.ts).
import { readFileSync } from "node:fs";
import { validatePack } from "../../src/pack.ts";
import { parsePackSource } from "../../src/packLiteral.ts";
import p from "../../src/stations/machine-electro.ts";
const file = new URL("../../src/stations/machine-electro.ts", import.meta.url);
console.log(validatePack(p as never));
parsePackSource(readFileSync(file, "utf8"));
console.log("literal ok");
