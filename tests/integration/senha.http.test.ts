import { beforeEach, describe, expect, it } from "vitest";
import { criarCenario } from "../support/cenario.ts";

let cenario: ReturnType<typeof criarCenario>;

const tokenDoUltimoEmail = () =>
  /token=([\w-]+)/.exec(cenario.memoria.emails.at(-1)?.texto ?? "")?.[1] ?? "";

beforeEach(async () => {
  cenario = criarCenario();
  await cenario.atleta("Silas Rodrigues", "silas@exemplo.com");
});

describe("Esqueci minha senha (RF-05)", () => {
  it("envia o link por e-mail; e-mail sem conta recebe a mesma resposta", async () => {
    const comConta = await cenario
      .como(null)
      .post("/auth/esqueci-senha", { email: "silas@exemplo.com" });
    const semConta = await cenario
      .como(null)
      .post("/auth/esqueci-senha", { email: "ninguem@exemplo.com" });

    expect(comConta.status).toBe(204);
    expect(semConta.status).toBe(204);
    expect(cenario.memoria.emails).toHaveLength(1);
    expect(cenario.memoria.emails[0]?.texto).toContain("nextpass://redefinir-senha?token=");
  });

  it("troca a senha pelo link, encerra as sessões e o link não vale de novo", async () => {
    const sessao = (await cenario.entrar("silas@exemplo.com")).body;
    await cenario.como(null).post("/auth/esqueci-senha", { email: "silas@exemplo.com" });
    const token = tokenDoUltimoEmail();

    const troca = await cenario
      .como(null)
      .post("/auth/redefinir-senha", { token, senha: "senha-nova-123" });
    expect(troca.status).toBe(204);

    expect((await cenario.entrar("silas@exemplo.com")).status).toBe(401);
    expect((await cenario.entrar("silas@exemplo.com", "senha-nova-123")).status).toBe(200);
    const renovar = await cenario
      .como(null)
      .post("/auth/refresh", { refreshToken: sessao.refreshToken });
    expect(renovar.status).toBe(401);

    const denovo = await cenario
      .como(null)
      .post("/auth/redefinir-senha", { token, senha: "outra-senha-12" });
    expect(denovo.body.erro.codigo).toBe("LINK_INVALIDO");
  });

  it("um pedido novo invalida o link anterior; senha curta é recusada", async () => {
    await cenario.como(null).post("/auth/esqueci-senha", { email: "silas@exemplo.com" });
    const antigo = tokenDoUltimoEmail();
    await cenario.como(null).post("/auth/esqueci-senha", { email: "silas@exemplo.com" });

    const comAntigo = await cenario
      .como(null)
      .post("/auth/redefinir-senha", { token: antigo, senha: "senha-nova-123" });
    expect(comAntigo.body.erro.codigo).toBe("LINK_INVALIDO");

    const curta = await cenario
      .como(null)
      .post("/auth/redefinir-senha", { token: tokenDoUltimoEmail(), senha: "123" });
    expect(curta.status).toBe(400);
  });
});
