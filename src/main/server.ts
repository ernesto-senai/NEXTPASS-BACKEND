import { env } from "../config/env.ts";
import { prisma } from "../shared/infra/database/prisma.ts";
import { createApp } from "./app.ts";

const server = createApp().listen(env.PORT, () => {
  console.log(`API NextPass ouvindo em http://localhost:${env.PORT}`);
});

function encerrar(sinal: string) {
  console.log(`${sinal} recebido, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => encerrar("SIGINT"));
process.on("SIGTERM", () => encerrar("SIGTERM"));
