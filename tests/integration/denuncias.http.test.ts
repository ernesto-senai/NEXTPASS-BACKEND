import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario } from "../support/cenario.ts";

let cenario: ReturnType<typeof criarCenario>;
let atleta: Conta;
let olheiro: Conta;

beforeEach(async () => {
  cenario = criarCenario();
  atleta = await cenario.atleta("Silas Rodrigues", "silas@exemplo.com");
  olheiro = await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
});

const denunciar = (conta: Conta, dados: object) => cenario.como(conta).post("/denuncias", dados);

describe("POST /denuncias (RF-54)", () => {
  it("registra a denúncia com o motivo", async () => {
    const { id } = cenario.avaliacao(olheiro);

    const resposta = await denunciar(atleta, {
      alvoTipo: "AVALIACAO",
      alvoId: id,
      motivo: "Pediram pagamento por PIX antes da peneira.",
    });

    expect(resposta.status).toBe(201);
    expect(resposta.body.status).toBe("ABERTA");
  });

  it("recusa alvo inexistente, o próprio conteúdo e motivo curto", async () => {
    const inexistente = await denunciar(atleta, {
      alvoTipo: "PERFIL",
      alvoId: "0199a1b2-0000-7000-8000-000000000999",
      motivo: "Perfil falso com fotos de outra pessoa.",
    });
    const proprio = await denunciar(atleta, {
      alvoTipo: "PERFIL",
      alvoId: atleta.id,
      motivo: "Testando denúncia do próprio perfil.",
    });
    const curto = await denunciar(atleta, {
      alvoTipo: "PERFIL",
      alvoId: olheiro.id,
      motivo: "ruim",
    });

    expect(inexistente.status).toBe(404);
    expect(proprio.status).toBe(400);
    expect(curto.status).toBe(400);
  });
});

describe("Moderação pelo administrador (RF-58)", () => {
  it("procedente com suspensão: a conta denunciada não entra mais", async () => {
    const admin = await cenario.admin();
    await denunciar(atleta, {
      alvoTipo: "PERFIL",
      alvoId: olheiro.id,
      motivo: "Pediu meu número de telefone fora do app.",
    });

    const fila = await cenario.como(admin).get("/admin/denuncias");
    expect(fila.body.dados).toMatchObject([
      { alvoTipo: "PERFIL", autor: { nome: "Silas Rodrigues" } },
    ]);

    const id = fila.body.dados[0].id as string;
    const decisao = await cenario.como(admin).patch(`/admin/denuncias/${id}`, {
      status: "PROCEDENTE",
      decisao: "Contato fora do app com menor.",
      suspenderConta: true,
    });
    expect(decisao.status).toBe(204);

    const login = await cenario.entrar("fabrizio@exemplo.com");
    expect(login.body.erro.codigo).toBe("CONTA_SUSPENSA");
    const denovo = await cenario
      .como(admin)
      .patch(`/admin/denuncias/${id}`, { status: "IMPROCEDENTE" });
    expect(denovo.body.erro.codigo).toBe("JA_ANALISADA");
  });
});
