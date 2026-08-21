import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Common Next.js UI patterns (close menus on route change, sync URL→local
      // draft state). Full rewrites are backlog; keep as warnings so CI stays green.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "generated/prisma/**",
  ]),
]);

export default eslintConfig;
