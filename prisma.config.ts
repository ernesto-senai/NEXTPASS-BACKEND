import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // process.env em vez de env(): assim `prisma generate` (postinstall) roda
  // num clone novo, antes de existir o .env. Só os comandos de migração
  // precisam do DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
