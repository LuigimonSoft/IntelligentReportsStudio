import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(
  root,
  "node_modules",
  "@esbuild",
  `${process.platform}-${process.arch}`,
);
const executable = path.join(
  packageRoot,
  process.platform === "win32" ? "esbuild.exe" : "bin/esbuild",
);
if (!existsSync(executable))
  throw new Error("Run npm ci before rebuilding browser assets.");
const result = spawnSync(
  executable,
  [
    "bridge.ts",
    "--bundle",
    "--format=esm",
    "--splitting",
    "--target=es2022",
    "--minify",
    "--outdir=../public/vendor",
    "--entry-names=reportstudio-runtime",
    "--chunk-names=[name]-[hash]",
    "--alias:@reportstudio/mini-reports=./engine/index.ts",
    "--metafile=../public/vendor/runtime-manifest.json",
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
