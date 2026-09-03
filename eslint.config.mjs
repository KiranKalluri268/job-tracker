// eslint-config-next v16 ships flat config directly, so no FlatCompat shim is needed.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
];

export default config;
