import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

const DIA = 24 * 60 * 60 * 1000;
const RESPONSAVEL = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let adulto: { id: string; token: string };
let menor: { id: string; token: string };
let olheiro: { id: string; token: string };

async function cadastrar(rota: string, dados: object) {
  const resposta = await request(app)
    .post(`/api/v1/${rota}`)
    .send({ senha: "senha-segura", aceiteTermos: true, ...dados });
  return { id: resposta.body.usuario.id as string, token: resposta.body.accessToken as string };
}

// Perfil técnico completo (RN-02), como o atleta preenche em Editar perfil.
function completarPerfil(id: string, nome: string, dataNascimento: string) {
  memoria.atletas.push({
    id,
    nome,
    fotoUrl: null,
    posicoes: ["ATA"],
    cidade: "São Paulo",
    uf: "SP",
    nacionalidade: "Brasileira",
    alturaCm: 176,
    pesoKg: 68,
    pePreferencial: "DESTRO",
    dataNascimento: new Date(dataNascimento),
  });
}

function avaliacao(dados: Partial<AvaliacaoResumo> = {}): AvaliacaoResumo {
  const nova: AvaliacaoResumo = {
    id: `0199a1b2-0000-7000-8000-00000000000${memoria.avaliacoes.length + 1}`,
    nome: "Peneira Sub-17",
    tipo: "PENEIRA",
    categoria: "SUB_17",
    posicoes: ["ATA"],
    dataHora: new Date(Date.now() + 7 * DIA),
    local: "CT da Barra Funda",
    cidade: "São Paulo",
    uf: "SP",
    taxaCentavos: 0,
    vagas: 10,
    vagasOcupadas: 0,
    status: "ABERTA",
    clube: null,
    olheiro: { id: olheiro.id, nome: "Fabrizio Romano" },
    ...dados,
  };
  memoria.avaliacoes.push(nova);
  return nova;
}

const convidar = (atletaId: string, avaliacaoId: string, mensagem = "Gostei dos seus lances!") =>
  request(app)
    .post("/api/v1/convites")
    .set("Authorization", `Bearer ${olheiro.token}`)
    .send({ atletaId, avaliacaoId, mensagem });

const caixa = (token: string) =>
  request(app).get("/api/v1/convites").set("Authorization", `Bearer ${token}`);

const responder = (token: string, conviteId: string, status: "ACEITO" | "RECUSADO") =>
  request(app)
    .patch(`/api/v1/convites/${conviteId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status });

const avisos = (usuarioId: string) =>
  memoria.notificacoes.filter((n) => n.usuarioId === usuarioId).map((n) => n.tipo);

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
  adulto = await cadastrar("atletas", { nome: "Silas Rodrigues", email: "silas@exemplo.com" });
  menor = await cadastrar("atletas", { nome: "Matheus Lima", email: "matheus@exemplo.com" });
  olheiro = await cadastrar("olheiros", {
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    telefone: "11912345678",
    atuacao: "INDEPENDENTE",
  });
  completarPerfil(adulto.id, "Silas Rodrigues", "2000-03-10");
  completarPerfil(menor.id, "Matheus Lima", "2010-05-20");
  memoria.responsaveis.set(menor.id, [RESPONSAVEL]);
  memoria.olheirosVerificados.add(olheiro.id);
});

describe("POST /convites (RF-39, RF-40)", () => {
  it("envia o convite, avisa o atleta e manda cópia ao responsável", async () => {
    const { id } = avaliacao();

    const resposta = await convidar(menor.id, id);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      status: "PENDENTE",
      avaliacao: { id, nome: "Peneira Sub-17" },
      copiaResponsavel: true,
    });
    expect(avisos(menor.id)).toEqual(["NOVO_CONVITE"]);
    expect(avisos(RESPONSAVEL)).toEqual(["COPIA_CONVITE"]);
  });

  it("recusa mensagem longa (RN-10), avaliação de outro olheiro (RN-11) e convite repetido", async () => {
    const propria = avaliacao();
    const deOutro = avaliacao({ olheiro: { id: RESPONSAVEL, nome: "Outro olheiro" } });

    expect((await convidar(adulto.id, propria.id, "a".repeat(301))).status).toBe(400);
    expect((await convidar(adulto.id, deOutro.id)).status).toBe(403);
    expect((await convidar(adulto.id, propria.id)).status).toBe(201);
    const repetido = await convidar(adulto.id, propria.id);
    expect(repetido.status).toBe(409);
    expect(repetido.body.erro.codigo).toBe("CONVITE_EXISTENTE");
  });

  it("exige olheiro verificado (RN-04)", async () => {
    memoria.olheirosVerificados.clear();

    const resposta = await convidar(adulto.id, avaliacao().id);

    expect(resposta.status).toBe(403);
    expect(resposta.body.erro.codigo).toBe("OLHEIRO_NAO_VERIFICADO");
  });
});

describe("Caixa de convites (RF-26, RF-27)", () => {
  it("adulto aceita: a inscrição confirmada ocupa a última vaga e expira os outros convites", async () => {
    const lotando = avaliacao({ vagas: 1 });
    const doAdulto = (await convidar(adulto.id, lotando.id)).body.id as string;
    await convidar(menor.id, lotando.id);

    const resposta = await responder(adulto.token, doAdulto, "ACEITO");

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      status: "ACEITO",
      inscricao: { status: "CONFIRMADA" },
    });
    expect(lotando).toMatchObject({ vagasOcupadas: 1, status: "ESGOTADA" });
    expect((await caixa(menor.token)).body.dados[0].status).toBe("EXPIRADO");
    expect(avisos(olheiro.id)).toEqual(["CONVITE_RESPONDIDO"]);

    const denovo = await responder(adulto.token, doAdulto, "RECUSADO");
    expect(denovo.status).toBe(409);
    expect(denovo.body.erro.codigo).toBe("CONVITE_ENCERRADO");
  });

  it("menor aceita: a inscrição aguarda o responsável, que é avisado (RN-03)", async () => {
    const peneira = avaliacao();
    const convite = (await convidar(menor.id, peneira.id)).body.id as string;

    const resposta = await responder(menor.token, convite, "ACEITO");

    expect(resposta.body.inscricao.status).toBe("AGUARDANDO_RESPONSAVEL");
    expect(peneira.vagasOcupadas).toBe(0);
    expect(avisos(RESPONSAVEL)).toEqual(["COPIA_CONVITE", "APROVAR_INSCRICAO"]);

    const { body } = await caixa(menor.token);
    expect(body.dados[0]).toMatchObject({
      status: "ACEITO",
      inscricao: { status: "AGUARDANDO_RESPONSAVEL" },
      mensagem: "Gostei dos seus lances!",
      avaliacao: { nome: "Peneira Sub-17", olheiro: { nome: "Fabrizio Romano" } },
    });
  });

  it("menor sem responsável vinculado ainda não aceita (RN-03)", async () => {
    memoria.responsaveis.clear();
    const convite = (await convidar(menor.id, avaliacao().id)).body.id as string;

    const resposta = await responder(menor.token, convite, "ACEITO");

    expect(resposta.status).toBe(422);
    expect(resposta.body.erro.codigo).toBe("VINCULO_PENDENTE");
    expect((await caixa(menor.token)).body.dados[0].status).toBe("PENDENTE");
  });

  it("só o atleta convidado responde, e a recusa avisa o olheiro", async () => {
    const convite = (await convidar(adulto.id, avaliacao().id)).body.id as string;

    expect((await responder(menor.token, convite, "RECUSADO")).status).toBe(404);
    const resposta = await responder(adulto.token, convite, "RECUSADO");

    expect(resposta.body).toEqual({ id: convite, status: "RECUSADO", inscricao: null });
    expect(memoria.notificacoes.at(-1)?.texto).toBe(
      "Silas Rodrigues recusou o convite para Peneira Sub-17.",
    );
  });

  it("convite de avaliação que já passou aparece expirado (RN-12)", async () => {
    const passada = avaliacao();
    const convite = (await convidar(adulto.id, passada.id)).body.id as string;
    passada.dataHora = new Date(Date.now() - DIA);

    expect((await caixa(adulto.token)).body.dados[0].status).toBe("EXPIRADO");
    expect((await responder(adulto.token, convite, "ACEITO")).status).toBe(409);
  });
});
