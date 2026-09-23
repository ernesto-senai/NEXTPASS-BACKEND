import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.ts";
import { errorHandler, notFoundHandler } from "../shared/http/middlewares/error-handler.ts";
import { routes } from "./routes.ts";

export function createApp() {
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

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
