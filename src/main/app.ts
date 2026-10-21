import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { z } from "zod";
import { env } from "../config/env.ts";
import { errorHandler, notFoundHandler } from "../shared/http/middlewares/error-handler.ts";
import { PASTA_UPLOADS } from "../shared/infra/storage/armazenamento-local.ts";
import { criarDependencias, type Dependencias } from "./dependencias.ts";
import { criarRotas } from "./routes.ts";

// Mensagens de validação padrão do Zod em português.
z.config(z.locales.pt());

export function createApp(deps: Dependencias = criarDependencias()) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      enabled: env.NODE_ENV !== "test",
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Lances (RF-25) e fotos de perfil (RF-14), com nome de arquivo aleatório. Só
  // essas pastas são públicas: documentos de verificação ficam fora (RNF-09).
  // A política "cross-origin" deixa o app web, em outra porta, mostrar os arquivos.
  for (const pasta of ["videos", "fotos"]) {
    app.use(
      `/uploads/${pasta}`,
      express.static(path.join(PASTA_UPLOADS, pasta), {
        setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
      }),
    );
  }

  app.use("/api/v1", criarRotas(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
