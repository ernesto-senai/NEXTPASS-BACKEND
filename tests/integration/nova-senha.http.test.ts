import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let refreshToken: string;

const EMAIL = "silas@exemplo.com";

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
  const cadastro = await request(app)
    .post("/api/v1/atletas")
    .send({ nome: "Silas Rodrigues", email: EMAIL, senha: "senha-antiga", aceiteTermos: true });
  refreshToken = cadastro.body.refreshToken;
});

const pedirCodigo = (email = EMAIL) =>
  request(app).post("/api/v1/auth/esqueci-senha").send({ email });
const redefinir = (codigo: string, novaSenha = "senha-nova-123") =>
  request(app).post("/api/v1/auth/redefinir-senha").send({ email: EMAIL, codigo, novaSenha });
const entrar = (senha: string) =>
  request(app).post("/api/v1/auth/login").send({ email: EMAIL, senha });
// O código vem no texto do e-mail, numa linha sozinha.
const ultimoCodigo = () => /^\d{6}$/m.exec(memoria.emails.at(-1)?.texto ?? "")?.[0] ?? "";
const outroCodigo = (codigo: string) => String((Number(codigo) + 1) % 1_000_000).padStart(6, "0");

describe("Esqueceu sua senha? (RF-05)", () => {
  it("manda um código de 6 números por e-mail e troca a senha com ele", async () => {
    expect((await pedirCodigo(" Silas@Exemplo.com ")).status).toBe(204);
    expect(memoria.emails.at(-1)).toMatchObject({ para: EMAIL });
    expect(ultimoCodigo()).toMatch(/^\d{6}$/);

    expect((await redefinir(ultimoCodigo())).status).toBe(204);
    expect((await entrar("senha-antiga")).status).toBe(401);
    expect((await entrar("senha-nova-123")).status).toBe(200);
  });

  it("encerra as sessões abertas nos outros aparelhos", async () => {
    await pedirCodigo();
    await redefinir(ultimoCodigo());

    const renovacao = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(renovacao.status).toBe(401);
  });

  it("responde do mesmo jeito para e-mail sem conta, sem mandar nada", async () => {
    expect((await pedirCodigo("ninguem@exemplo.com")).status).toBe(204);
    expect(memoria.emails).toHaveLength(0);
  });

  it("recusa código errado, já usado ou vencido", async () => {
    await pedirCodigo();
    const codigo = ultimoCodigo();

    const errado = await redefinir(outroCodigo(codigo));
    expect(errado.status).toBe(400);
    expect(errado.body.erro.codigo).toBe("CODIGO_INVALIDO");
    expect((await redefinir(codigo)).status).toBe(204);
    expect((await redefinir(codigo)).status).toBe(400);

    await pedirCodigo();
    memoria.codigosDeSenha.at(-1)!.expiraEm = new Date(Date.now() - 1000);
    expect((await redefinir(ultimoCodigo())).status).toBe(400);
  });

  it("um código novo substitui o anterior", async () => {
    await pedirCodigo();
    await pedirCodigo();

    expect(memoria.codigosDeSenha).toHaveLength(1);
    expect((await redefinir(ultimoCodigo())).status).toBe(204);
  });

  it("aceita até 3 pedidos de código a cada 15 minutos", async () => {
    for (let pedido = 0; pedido < 3; pedido++) expect((await pedirCodigo()).status).toBe(204);

    const bloqueado = await pedirCodigo();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro.codigo).toBe("MUITAS_TENTATIVAS");
  });

  it("confere o formato do código e o tamanho da nova senha", async () => {
    const resposta = await redefinir("12ab", "curta");

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.erro.campos).sort()).toEqual(["codigo", "novaSenha"]);
  });
});
