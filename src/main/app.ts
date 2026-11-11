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
  // Publicado no Render, os pedidos passam por um proxy. Assim o limite de tentativas
  // de login (RNF-08) vê o IP de quem acessa, e não o do proxy.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

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

  // Só as pastas de lances (RF-25) e fotos (RF-14) são públicas, com nome de arquivo
  // aleatório; documentos não (RNF-09). "cross-origin" para o app web mostrar os arquivos.
  // Com STORAGE_DRIVER=s3, quem entrega os arquivos é o serviço de armazenamento.
  if (env.STORAGE_DRIVER === "local") {
    for (const pasta of ["videos", "fotos"]) {
      app.use(
        `/uploads/${pasta}`,
        express.static(path.join(PASTA_UPLOADS, pasta), {
          setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
        }),
      );
    }
  }

  app.use("/api/v1", criarRotas(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
