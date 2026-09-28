import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

const DIA = 24 * 60 * 60 * 1000;
const daqui = (dias: number) => new Date(Date.now() + dias * DIA);

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

function avaliacao(dados: Partial<AvaliacaoResumo>): AvaliacaoResumo {
  const nova: AvaliacaoResumo = {
    id: `av-${memoria.avaliacoes.length + 1}`,
    nome: "Peneira Sub-17",
    tipo: "PENEIRA",
    categoria: "SUB_17",
    posicoes: ["ATA"],
    dataHora: daqui(7),
    local: "CT da Barra Funda",
    cidade: "São Paulo",
    uf: "SP",
    taxaCentavos: 3000,
    vagas: 22,
    vagasOcupadas: 9,
    status: "ABERTA",
    clube: null,
    olheiro: { id: olheiro.id, nome: "Fabrizio Romano" },
    ...dados,
  };
  memoria.avaliacoes.push(nova);
  return nova;
}

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

describe("GET /avaliacoes (RF-18)", () => {
  it("lista as futuras, abertas ou esgotadas, da mais próxima para a mais distante", async () => {
    avaliacao({ nome: "Daqui a 10 dias", dataHora: daqui(10) });
    avaliacao({ nome: "Esgotada", dataHora: daqui(5), status: "ESGOTADA", vagasOcupadas: 22 });
    avaliacao({ nome: "Já passou", dataHora: daqui(-1) });
    avaliacao({ nome: "Cancelada", status: "CANCELADA" });

    const resposta = await request(app)
      .get("/api/v1/avaliacoes")
      .set("Authorization", `Bearer ${atleta.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.map((a: AvaliacaoResumo) => a.nome)).toEqual([
      "Esgotada",
      "Daqui a 10 dias",
    ]);
    expect(resposta.body).toMatchObject({ total: 2, pagina: 1 });
    expect(resposta.body.dados[0]).not.toHaveProperty("endereco");
  });

  it("pagina os resultados (RNF-02)", async () => {
    avaliacao({ dataHora: daqui(1) });
    avaliacao({ dataHora: daqui(2) });

    const resposta = await request(app)
      .get("/api/v1/avaliacoes?pagina=2&limite=1")
      .set("Authorization", `Bearer ${atleta.token}`);

    expect(resposta.body.dados).toHaveLength(1);
    expect(resposta.body).toMatchObject({ total: 2, pagina: 2 });
  });

  it("é exclusiva do atleta", async () => {
    const semToken = await request(app).get("/api/v1/avaliacoes");
    const comoOlheiro = await request(app)
      .get("/api/v1/avaliacoes")
      .set("Authorization", `Bearer ${olheiro.token}`);

    expect(semToken.status).toBe(401);
    expect(comoOlheiro.status).toBe(403);
  });
});

describe("GET /perfil/inscricoes (RF-19)", () => {
  it("separa as inscrições ativas das avaliações já participadas", async () => {
    const futura = avaliacao({ nome: "Futura" });
    const passada = avaliacao({ nome: "Passada", dataHora: daqui(-3), status: "ENCERRADA" });
    memoria.inscricoes.push(
      { id: "i1", atletaId: atleta.id, avaliacaoId: futura.id, status: "AGUARDANDO_RESPONSAVEL" },
      { id: "i2", atletaId: atleta.id, avaliacaoId: passada.id, status: "CONFIRMADA" },
    );

    const listar = (situacao: string) =>
      request(app)
        .get(`/api/v1/perfil/inscricoes?situacao=${situacao}`)
        .set("Authorization", `Bearer ${atleta.token}`);
    const ativas = await listar("ativas");
    const participadas = await listar("participadas");

    expect(ativas.body.dados).toEqual([
      expect.objectContaining({
        status: "AGUARDANDO_RESPONSAVEL",
        avaliacao: expect.objectContaining({ nome: "Futura" }),
      }),
    ]);
    expect(participadas.body.dados).toEqual([
      expect.objectContaining({
        status: "CONFIRMADA",
        avaliacao: expect.objectContaining({ nome: "Passada" }),
      }),
    ]);
  });
});

describe("GET /videos (RF-32)", () => {
  const lance = (id: string, dias: number) => ({
    id,
    url: `https://exemplo.com/${id}.mp4`,
    legenda: "Gol de falta",
    localizacao: "São Paulo, SP",
    duracaoSeg: 45,
    criadoEm: daqui(dias),
    atleta: { id: atleta.id, nome: "Silas Rodrigues", fotoUrl: null },
  });

  it("bloqueia olheiro ainda não verificado (RN-04)", async () => {
    const resposta = await request(app)
      .get("/api/v1/videos")
      .set("Authorization", `Bearer ${olheiro.token}`);

    expect(resposta.status).toBe(403);
    expect(resposta.body.erro.codigo).toBe("OLHEIRO_NAO_VERIFICADO");
  });

  it("mostra os lances mais recentes primeiro para o olheiro verificado", async () => {
    memoria.olheirosVerificados.add(olheiro.id);
    memoria.lances.push(lance("antigo", -2), lance("recente", -1));

    const resposta = await request(app)
      .get("/api/v1/videos")
      .set("Authorization", `Bearer ${olheiro.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.map((l: { id: string }) => l.id)).toEqual(["recente", "antigo"]);
  });

  it("registra visualizações (RF-33)", async () => {
    const id = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    memoria.olheirosVerificados.add(olheiro.id);
    memoria.lances.push(lance(id, -1));

    const registrar = (videoId: string) =>
      request(app)
        .post(`/api/v1/videos/${videoId}/visualizacoes`)
        .set("Authorization", `Bearer ${olheiro.token}`);

    expect((await registrar(id)).status).toBe(204);
    expect((await registrar("0199a1b2-0000-7000-8000-000000000000")).status).toBe(404);
    expect((await registrar("nao-e-um-id")).status).toBe(400);

    const feed = await request(app)
      .get("/api/v1/videos")
      .set("Authorization", `Bearer ${olheiro.token}`);
    expect(feed.body.dados[0].visualizacoes).toBe(1);
  });
});
