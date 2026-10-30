import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local, gitignored working folders ESLint would otherwise crawl: agent worktrees, the phone/dev build output,
    // and the Supabase CLI's temp folder.
    ".claude/**",
    ".next-phone/**",
    ".next-test/**",
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
