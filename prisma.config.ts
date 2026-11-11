import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // process.env em vez de env() para o prisma generate (postinstall) funcionar
  // antes de existir o .env. Só as migrações precisam do DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
