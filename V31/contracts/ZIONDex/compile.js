const fs = require("fs");
const path = require("path");
const solc = require("solc");

const dir = __dirname;
const files = [
  "ZIONDexFactory.sol",
  "ZIONDexPair.sol",
  "ZIONDexRouter.sol",
  "ZIONDexZISGate.sol",
];

const sources = {};
for (const f of files) {
  sources[f] = { content: fs.readFileSync(path.join(dir, f), "utf8") };
}

const input = {
  language: "Solidity",
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"],
      },
    },
  },
  sources,
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

let hadError = false;
if (output.errors) {
  for (const e of output.errors) {
    console.log(`[${e.severity}] ${e.formattedMessage}`);
    if (e.severity === "error") hadError = true;
  }
}

if (hadError) {
  console.log("\nCOMPILATION FAILED");
  process.exit(1);
}

const outDir = path.join(dir, "build");
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const contracts = output.contracts[file];
  if (!contracts) continue;
  for (const name of Object.keys(contracts)) {
    const c = contracts[name];
    const base = path.join(outDir, `${file.replace(".sol", "")}_${name}`);
    fs.writeFileSync(base + ".abi", JSON.stringify(c.abi));
    fs.writeFileSync(base + ".bin", c.evm.bytecode.object || "");
    console.log(`OK  ${file}:${name}  bytecode=${(c.evm.bytecode.object || "").length / 2} bytes`);
  }
}

console.log("\nCOMPILATION SUCCESS — build/ written");
