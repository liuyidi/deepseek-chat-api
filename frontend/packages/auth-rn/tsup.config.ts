import { defineConfig } from "tsup";

const external = [
  "react",
  "react-native",
  "react-native-safe-area-context",
  "react-native-svg",
];

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    outDir: "dist",
    external,
  },
  {
    entry: { screens: "src/screens.ts" },
    format: ["cjs", "esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "es2022",
    outDir: "dist",
    external,
  },
]);
