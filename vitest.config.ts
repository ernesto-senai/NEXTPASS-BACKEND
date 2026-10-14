import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://nextpass:nextpass@localhost:5432/nextpass_test",
      JWT_ACCESS_SECRET: "segredo-de-acesso-apenas-para-testes-000",
    },
  },
});
