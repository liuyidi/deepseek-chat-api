import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    screens: "src/screens.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  outDir: "dist",
  external: [
    "react",
    "react-native",
    "react-native-safe-area-context",
    "react-native-svg",
  ],
});
