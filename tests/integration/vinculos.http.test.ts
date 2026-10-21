import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario } from "../support/cenario.ts";

let cenario: ReturnType<typeof criarCenario>;
let menor: Conta;

// O link do e-mail traz o token: nextpass://confirmar-vinculo?token=...
const tokenDoUltimoEmail = () =>
  /token=([\w-]+)/.exec(cenario.memoria.emails.at(-1)?.texto ?? "")?.[1] ?? "";

beforeEach(async () => {
  cenario = criarCenario();
  menor = await cenario.atleta("Matheus Lima", "matheus@exemplo.com");
  cenario.completarPerfil(menor, "Matheus Lima", "2010-05-20");
});

const pedir = (email = "ana@exemplo.com") =>
  cenario.como(menor).post("/vinculos", { emailResponsavel: email });

describe("POST /vinculos (RF-15)", () => {
  it("envia ao responsável o e-mail com o link de confirmação", async () => {
    const resposta = await pedir();

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      emailResponsavel: "ana@exemplo.com",
      status: "PENDENTE",
    });
    const email = cenario.memoria.emails.at(-1)!;
    expect(email.para).toBe("ana@exemplo.com");
    expect(email.texto).toContain("Matheus Lima indicou você como responsável");
    expect(email.texto).toContain("nextpass://confirmar-vinculo?token=");

    const vinculos = await cenario.como(menor).get("/vinculos");
    expect(vinculos.body).toMatchObject([
      { emailResponsavel: "ana@exemplo.com", status: "PENDENTE" },
    ]);
  });

  it("não aceita o próprio e-mail do atleta", async () => {
    expect((await pedir("matheus@exemplo.com")).status).toBe(400);
  });
});

describe("Confirmar vínculo pelo link (RF-48)", () => {
  it("o responsável cria a conta, entra no app e passa a aprovar as inscrições", async () => {
    await pedir();
    const token = tokenDoUltimoEmail();

    const pedido = await cenario.como(null).get(`/vinculos/pedido?token=${token}`);
    expect(pedido.body).toEqual({
      atleta: { nome: "Matheus Lima" },
      emailResponsavel: "ana@exemplo.com",
      contaExistente: false,
    });

    const aceite = await cenario.como(null).post("/responsaveis", {
      token,
      nome: "Ana Rodrigues",
      senha: "senha-segura",
      aceiteTermos: true,
    });
    expect(aceite.status).toBe(201);
    expect(aceite.body.usuario).toMatchObject({ nome: "Ana Rodrigues", tipo: "RESPONSAVEL" });

    const ana = { id: aceite.body.usuario.id, token: aceite.body.accessToken };
    const atletas = await cenario.como(ana).get("/vinculos");
    expect(atletas.body).toMatchObject([{ atleta: { nome: "Matheus Lima" } }]);
    expect(typeof atletas.body[0].atleta.idade).toBe("number");

    const doAtleta = await cenario.como(menor).get("/vinculos");
    expect(doAtleta.body[0]).toMatchObject({
      status: "CONFIRMADO",
      responsavel: { nome: "Ana Rodrigues" },
    });

    // O link é de uso único.
    const denovo = await cenario.como(null).get(`/vinculos/pedido?token=${token}`);
    expect(denovo.body.erro.codigo).toBe("LINK_INVALIDO");
  });

  it("responsável que já tem conta confirma com a senha", async () => {
    const irmao = await cenario.atleta("Lucas Lima", "lucas@exemplo.com");
    await cenario.como(irmao).post("/vinculos", { emailResponsavel: "ana@exemplo.com" });
    await cenario.como(null).post("/responsaveis", {
      token: tokenDoUltimoEmail(),
      nome: "Ana Rodrigues",
      senha: "senha-segura",
      aceiteTermos: true,
    });

    await pedir();
    const token = tokenDoUltimoEmail();
    expect(
      (await cenario.como(null).get(`/vinculos/pedido?token=${token}`)).body.contaExistente,
    ).toBe(true);

    const senhaErrada = await cenario
      .como(null)
      .post("/responsaveis", { token, senha: "outra-senha" });
    expect(senhaErrada.body.erro.codigo).toBe("CREDENCIAIS_INVALIDAS");

    const aceite = await cenario.como(null).post("/responsaveis", { token, senha: "senha-segura" });
    expect(aceite.status).toBe(201);
    const ana = { id: aceite.body.usuario.id, token: aceite.body.accessToken };
    expect((await cenario.como(ana).get("/vinculos")).body).toHaveLength(2);
  });

  it("recusa link inválido e e-mail que já é de atleta ou olheiro", async () => {
    const invalido = await cenario.como(null).get("/vinculos/pedido?token=nao-e-um-token-valido");
    expect(invalido.status).toBe(400);
    expect(invalido.body.erro.codigo).toBe("LINK_INVALIDO");

    await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
    await pedir("fabrizio@exemplo.com");
    const aceite = await cenario.como(null).post("/responsaveis", {
      token: tokenDoUltimoEmail(),
      senha: "senha-segura",
    });
    expect(aceite.body.erro.codigo).toBe("EMAIL_JA_CADASTRADO");
  });
});

describe("GET /convites para o responsável (RF-49)", () => {
  it("mostra os convites dos atletas vinculados", async () => {
    const olheiro = await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
    cenario.memoria.olheirosVerificados.add(olheiro.id);
    const peneira = cenario.avaliacao(olheiro);
    await pedir();
    const aceite = await cenario.como(null).post("/responsaveis", {
      token: tokenDoUltimoEmail(),
      nome: "Ana Rodrigues",
      senha: "senha-segura",
      aceiteTermos: true,
    });
    await cenario
      .como(olheiro)
      .post("/convites", { atletaId: menor.id, avaliacaoId: peneira.id, mensagem: "Venha!" });

    const ana = { id: aceite.body.usuario.id, token: aceite.body.accessToken };
    const convites = await cenario.como(ana).get("/convites");

    expect(convites.body.dados).toMatchObject([
      { mensagem: "Venha!", atleta: { nome: "Matheus Lima" }, status: "PENDENTE" },
    ]);
    expect(cenario.avisos(ana.id)).toEqual(["COPIA_CONVITE"]);
  });
});
