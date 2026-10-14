import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";

const app = createApp();

describe("app", () => {
  it("responde ao health check", async () => {
    const resposta = await request(app).get("/health");

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ status: "ok" });
  });

  it("devolve erro no formato padrão para rota inexistente", async () => {
    const resposta = await request(app).get("/api/v1/rota-inexistente");

    expect(resposta.status).toBe(404);
    expect(resposta.body.erro.codigo).toBe("NAO_ENCONTRADO");
  });
});
