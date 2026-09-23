import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { z } from "zod";
import { env } from "../config/env.ts";
import { errorHandler, notFoundHandler } from "../shared/http/middlewares/error-handler.ts";
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

  app.use("/api/v1", criarRotas(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
