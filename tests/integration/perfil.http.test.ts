import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let atleta: { id: string; token: string };
let olheiro: { id: string; token: string };

async function cadastrar(rota: string, dados: object) {
  const resposta = await request(app)
    .post(`/api/v1/${rota}`)
    .send({ senha: "senha-segura", aceiteTermos: true, ...dados });
  return { id: resposta.body.usuario.id as string, token: resposta.body.accessToken as string };
}

// Nascido em 1º de janeiro: tem 20 anos o ano todo (Sub-20, RN-01).
const vinteAnos = `${new Date().getUTCFullYear() - 20}-01-01`;

const dadosTecnicos = (dados: object = {}) => ({
  nome: "Silas Rodrigues",
  dataNascimento: vinteAnos,
  posicoes: ["PE", "ATA"],
  alturaCm: 174,
  pesoKg: 68,
  pePreferencial: "DESTRO",
  cidade: "São Paulo",
  uf: "sp",
  nacionalidade: "Brasileira",
  ...dados,
});

const consultar = (token: string) =>
  request(app).get("/api/v1/perfil").set("Authorization", `Bearer ${token}`);

const editar = (token: string, dados: object) =>
  request(app).patch("/api/v1/perfil").set("Authorization", `Bearer ${token}`).send(dados);

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
  atleta = await cadastrar("atletas", { nome: "Silas", email: "silas@exemplo.com" });
  olheiro = await cadastrar("olheiros", {
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    telefone: "11912345678",
    atuacao: "INDEPENDENTE",
  });
});

describe("GET /perfil (RF-14)", () => {
  it("mostra o atleta recém-cadastrado com o perfil ainda incompleto (RN-02)", async () => {
    const resposta = await consultar(atleta.token);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      nome: "Silas",
      tipo: "ATLETA",
      olheiro: null,
      atleta: { perfilCompleto: false, idade: null, categoria: null, posicoes: [] },
    });
  });

  it("mostra os dados do olheiro, com a verificação", async () => {
    const resposta = await consultar(olheiro.token);

    expect(resposta.body).toMatchObject({
      tipo: "OLHEIRO",
      atleta: null,
      olheiro: { atuacao: "INDEPENDENTE", verificado: false },
    });
  });
});

describe("PATCH /perfil (RF-13)", () => {
  it("completa o perfil, calcula idade e categoria e libera o atleta na busca", async () => {
    const resposta = await editar(atleta.token, dadosTecnicos());

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      nome: "Silas Rodrigues",
      atleta: { perfilCompleto: true, idade: 20, categoria: "SUB_20", uf: "SP" },
    });

    memoria.olheirosVerificados.add(olheiro.id);
    const busca = await request(app)
      .get("/api/v1/atletas")
      .set("Authorization", `Bearer ${olheiro.token}`);
    expect(busca.body.dados.map((a: { nome: string }) => a.nome)).toEqual(["Silas Rodrigues"]);
  });

  it("aponta os campos inválidos", async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const resposta = await editar(
      atleta.token,
      dadosTecnicos({ dataNascimento: amanha, posicoes: [], uf: "XX", alturaCm: 17.4 }),
    );

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.erro.campos).sort()).toEqual([
      "alturaCm",
      "dataNascimento",
      "posicoes",
      "uf",
    ]);
  });

  it("é só do atleta", async () => {
    expect((await editar(olheiro.token, dadosTecnicos())).status).toBe(403);
  });
});
