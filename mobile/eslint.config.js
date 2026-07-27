const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**"],
    rules: {
      "import/no-unresolved": [
        "error",
        {
          ignore: ["^@/auth/session-storage$"],
        },
      ],
    },
  },
  {
    files: [
      "src/app/(app)/index.tsx",
      "src/dashboard/use-dashboard-data.ts",
      "src/groups/group-detail-screen.tsx",
      "src/today/use-today-data.ts",
      "src/transactions/use-transaction-detail.ts",
      "src/transactions/use-transaction-history.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
