import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

const DIA = 24 * 60 * 60 * 1000;

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

const novaAvaliacao = (dados: object = {}) => ({
  nome: "Peneira Sub-17",
  tipo: "PENEIRA",
  categoria: "SUB_17",
  posicoes: ["MEI", "ATA"],
  requisitos: "Chuteira, caneleira e documento com foto",
  taxaCentavos: 2500,
  vagas: 30,
  dataHora: new Date(Date.now() + 10 * DIA).toISOString(),
  local: "CT da Barra Funda",
  endereco: "Rua Dr. Moraes Sales, 1000 - Barra Funda",
  cidade: "São Paulo",
  uf: "sp",
  ...dados,
});

const criar = (token: string, dados: object) =>
  request(app).post("/api/v1/avaliacoes").set("Authorization", `Bearer ${token}`).send(dados);

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
  atleta = await cadastrar("atletas", { nome: "Silas Rodrigues", email: "silas@exemplo.com" });
  olheiro = await cadastrar("olheiros", {
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    telefone: "11912345678",
    atuacao: "INDEPENDENTE",
  });
});

describe("POST /avaliacoes (RF-41)", () => {
  it("cria a avaliação aberta, que aparece para os atletas", async () => {
    memoria.olheirosVerificados.add(olheiro.id);

    const resposta = await criar(olheiro.token, novaAvaliacao());

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      nome: "Peneira Sub-17",
      uf: "SP",
      vagas: 30,
      vagasOcupadas: 0,
      status: "ABERTA",
      olheiro: { id: olheiro.id, nome: "Fabrizio Romano" },
    });

    const feed = await request(app)
      .get("/api/v1/avaliacoes")
      .set("Authorization", `Bearer ${atleta.token}`);
    expect(feed.body.dados.map((a: { id: string }) => a.id)).toEqual([resposta.body.id]);
  });

  it("aponta os campos inválidos", async () => {
    memoria.olheirosVerificados.add(olheiro.id);

    const resposta = await criar(
      olheiro.token,
      novaAvaliacao({ posicoes: [], uf: "XX", vagas: 0, dataHora: "29/11/2026" }),
    );

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.erro.campos).sort()).toEqual([
      "dataHora",
      "posicoes",
      "uf",
      "vagas",
    ]);
  });

  it("recusa data que já passou", async () => {
    memoria.olheirosVerificados.add(olheiro.id);

    const resposta = await criar(
      olheiro.token,
      novaAvaliacao({ dataHora: new Date(Date.now() - DIA).toISOString() }),
    );

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe("DADOS_INVALIDOS");
    expect(memoria.avaliacoes).toHaveLength(0);
  });

  it("exige olheiro verificado (RN-04)", async () => {
    const naoVerificado = await criar(olheiro.token, novaAvaliacao());
    const doAtleta = await criar(atleta.token, novaAvaliacao());

    expect(naoVerificado.status).toBe(403);
    expect(naoVerificado.body.erro.codigo).toBe("OLHEIRO_NAO_VERIFICADO");
    expect(doAtleta.status).toBe(403);
    expect(doAtleta.body.erro.codigo).toBe("ACESSO_NEGADO");
  });
});

describe("GET /perfil/verificacao (RF-17)", () => {
  const consultar = (token: string) =>
    request(app).get("/api/v1/perfil/verificacao").set("Authorization", `Bearer ${token}`);

  it("informa se as funções do olheiro já estão liberadas", async () => {
    expect((await consultar(olheiro.token)).body).toEqual({
      verificado: false,
      status: null,
      motivoRecusa: null,
    });

    memoria.olheirosVerificados.add(olheiro.id);
    expect((await consultar(olheiro.token)).body).toMatchObject({
      verificado: true,
      status: "APROVADA",
    });
  });

  it("é só do olheiro", async () => {
    expect((await consultar(atleta.token)).status).toBe(403);
  });
});

describe("Minhas avaliações (RF-42, RF-43)", () => {
  const minhas = (token: string, situacao = "proximas") =>
    request(app)
      .get(`/api/v1/perfil/avaliacoes?situacao=${situacao}`)
      .set("Authorization", `Bearer ${token}`);
  const cancelar = (token: string, id: string) =>
    request(app).delete(`/api/v1/avaliacoes/${id}`).set("Authorization", `Bearer ${token}`);

  beforeEach(() => {
    memoria.olheirosVerificados.add(olheiro.id);
  });

  it("separa as próximas das anteriores, com os participantes", async () => {
    const daqui10 = (await criar(olheiro.token, novaAvaliacao({ nome: "Daqui a 10 dias" }))).body;
    await criar(
      olheiro.token,
      novaAvaliacao({
        nome: "Daqui a 3 dias",
        dataHora: new Date(Date.now() + 3 * DIA).toISOString(),
      }),
    );
    memoria.avaliacoes.find((a) => a.id === daqui10.id)!.vagasOcupadas = 12;

    const proximas = (await minhas(olheiro.token)).body;
    expect(proximas.dados.map((a: { nome: string }) => a.nome)).toEqual([
      "Daqui a 3 dias",
      "Daqui a 10 dias",
    ]);
    expect(proximas.dados[1]).toMatchObject({ vagas: 30, vagasOcupadas: 12 });
    expect((await minhas(olheiro.token, "anteriores")).body.total).toBe(0);
  });

  it("cancela a avaliação, cancela as inscrições e avisa os inscritos", async () => {
    const { id } = (await criar(olheiro.token, novaAvaliacao())).body;
    memoria.inscricoes.push({
      id: "0199a1b2-0000-7000-8000-0000000000aa",
      atletaId: atleta.id,
      avaliacaoId: id,
      status: "CONFIRMADA",
    });

    expect((await cancelar(olheiro.token, id)).status).toBe(204);

    expect((await minhas(olheiro.token, "anteriores")).body.dados[0]).toMatchObject({
      id,
      status: "CANCELADA",
    });
    expect(memoria.inscricoes[0]?.status).toBe("CANCELADA");
    expect(memoria.notificacoes.map((n) => [n.usuarioId, n.tipo])).toEqual([
      [atleta.id, "AVALIACAO_ALTERADA"],
    ]);
    expect((await cancelar(olheiro.token, id)).body.erro.codigo).toBe("AVALIACAO_ENCERRADA");
  });

  it("só o dono cancela (RN-11)", async () => {
    const { id } = (await criar(olheiro.token, novaAvaliacao())).body;
    const outro = await cadastrar("olheiros", {
      nome: "Carla Mendes",
      email: "carla@exemplo.com",
      telefone: "11987654321",
      atuacao: "INDEPENDENTE",
    });
    memoria.olheirosVerificados.add(outro.id);

    expect((await cancelar(outro.token, id)).status).toBe(403);
    expect((await minhas(outro.token)).body.total).toBe(0);
  });
});
