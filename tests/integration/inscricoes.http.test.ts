import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario } from "../support/cenario.ts";

const RESPONSAVEL = { id: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b", token: "" };

let cenario: ReturnType<typeof criarCenario>;
let adulto: Conta;
let menor: Conta;
let olheiro: Conta;

beforeEach(async () => {
  cenario = criarCenario();
  adulto = await cenario.atleta("Silas Rodrigues", "silas@exemplo.com");
  menor = await cenario.atleta("Matheus Lima", "matheus@exemplo.com");
  olheiro = await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
  cenario.completarPerfil(adulto, "Silas Rodrigues", "2000-03-10");
  cenario.completarPerfil(menor, "Matheus Lima", "2010-05-20");
  cenario.memoria.olheirosVerificados.add(olheiro.id);
});

const participar = (conta: Conta, avaliacaoId: string) =>
  cenario.como(conta).post(`/avaliacoes/${avaliacaoId}/inscricoes`);

const alterar = (conta: Conta, inscricaoId: string, status: string) =>
  cenario.como(conta).patch(`/inscricoes/${inscricaoId}`, { status });

describe("GET /avaliacoes/:id (RF-20, RN-08)", () => {
  it("mostra os detalhes, e o endereço só depois da confirmação", async () => {
    const { id } = cenario.avaliacao(olheiro);

    const antes = await cenario.como(adulto).get(`/avaliacoes/${id}`);
    expect(antes.status).toBe(200);
    expect(antes.body).toMatchObject({
      nome: "Peneira Sub-17",
      requisitos: "Chuteira e documento com foto",
      endereco: null,
      minhaInscricao: null,
    });

    await participar(adulto, id);
    const depois = await cenario.como(adulto).get(`/avaliacoes/${id}`);
    expect(depois.body).toMatchObject({
      endereco: "Rua de teste, 100",
      minhaInscricao: { status: "CONFIRMADA" },
    });

    const doDono = await cenario.como(olheiro).get(`/avaliacoes/${id}`);
    expect(doDono.body.endereco).toBe("Rua de teste, 100");
  });
});

describe("POST /avaliacoes/:id/inscricoes (RF-21)", () => {
  it("adulto entra confirmado, ocupa a vaga e o olheiro é avisado", async () => {
    const peneira = cenario.avaliacao(olheiro);

    const resposta = await participar(adulto, peneira.id);

    expect(resposta.status).toBe(201);
    expect(resposta.body.status).toBe("CONFIRMADA");
    expect(peneira.vagasOcupadas).toBe(1);
    expect(cenario.avisos(olheiro.id)).toEqual(["NOVA_INSCRICAO"]);
    expect((await participar(adulto, peneira.id)).body.erro.codigo).toBe("INSCRICAO_EXISTENTE");
  });

  it("menor espera o responsável (RN-03) e perfil incompleto não se inscreve (RN-02)", async () => {
    cenario.memoria.responsaveis.set(menor.id, [RESPONSAVEL.id]);
    const peneira = cenario.avaliacao(olheiro);
    const semPerfil = await cenario.atleta("Leandro Sousa", "leandro@exemplo.com");

    const doMenor = await participar(menor, peneira.id);

    expect(doMenor.body.status).toBe("AGUARDANDO_RESPONSAVEL");
    expect(peneira.vagasOcupadas).toBe(0);
    expect(cenario.avisos(RESPONSAVEL.id)).toEqual(["APROVAR_INSCRICAO"]);
    expect((await participar(semPerfil, peneira.id)).body.erro.codigo).toBe("PERFIL_INCOMPLETO");
  });

  it("avaliação lotada recusa com VAGAS_ESGOTADAS (RN-06)", async () => {
    const lotada = cenario.avaliacao(olheiro, { vagas: 1 });
    await participar(adulto, lotada.id);
    const outro = await cenario.atleta("Leandro Sousa", "leandro@exemplo.com");
    cenario.completarPerfil(outro, "Leandro Sousa", "1999-01-01");

    const resposta = await participar(outro, lotada.id);

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro.codigo).toBe("VAGAS_ESGOTADAS");
  });
});

describe("PATCH /inscricoes/:id (RF-22, RF-46, RF-50)", () => {
  it("atleta cancela e a vaga volta; a avaliação esgotada reabre", async () => {
    const lotada = cenario.avaliacao(olheiro, { vagas: 1 });
    const { id } = (await participar(adulto, lotada.id)).body;
    expect(lotada.status).toBe("ESGOTADA");

    const resposta = await alterar(adulto, id, "CANCELADA");

    expect(resposta.status).toBe(200);
    expect(lotada).toMatchObject({ vagasOcupadas: 0, status: "ABERTA" });
    expect((await alterar(adulto, id, "CANCELADA")).body.erro.codigo).toBe("INSCRICAO_ENCERRADA");
    expect((await participar(adulto, lotada.id)).status).toBe(201);
  });

  it("olheiro dono remove o inscrito, que é avisado; outro olheiro não", async () => {
    const peneira = cenario.avaliacao(olheiro);
    const { id } = (await participar(adulto, peneira.id)).body;
    const outro = await cenario.olheiro("Carla Mendes", "carla@exemplo.com");
    cenario.memoria.olheirosVerificados.add(outro.id);

    expect((await alterar(outro, id, "REMOVIDA")).status).toBe(403);
    expect((await alterar(olheiro, id, "CANCELADA")).status).toBe(400);
    expect((await alterar(olheiro, id, "REMOVIDA")).status).toBe(200);
    expect(peneira.vagasOcupadas).toBe(0);
    expect(cenario.avisos(adulto.id)).toEqual(["INSCRICAO_ATUALIZADA"]);
  });

  it("responsável aprova: a inscrição ocupa a vaga e atleta e olheiro são avisados", async () => {
    const responsavel = await cenario.cadastrar("atletas", {
      nome: "Ana Rodrigues",
      email: "ana@exemplo.com",
    });
    cenario.memoria.usuarios.find((u) => u.id === responsavel.id)!.tipo = "RESPONSAVEL";
    const anaToken = (await cenario.entrar("ana@exemplo.com")).body.accessToken;
    const ana = { id: responsavel.id, token: anaToken };
    cenario.memoria.responsaveis.set(menor.id, [ana.id]);
    const peneira = cenario.avaliacao(olheiro);
    const { id } = (await participar(menor, peneira.id)).body;

    const pendentes = await cenario.como(ana).get("/perfil/inscricoes");
    expect(pendentes.body.dados).toMatchObject([
      { id, status: "AGUARDANDO_RESPONSAVEL", atleta: { nome: "Matheus Lima" } },
    ]);

    expect((await alterar(ana, id, "CONFIRMADA")).status).toBe(200);
    expect(peneira.vagasOcupadas).toBe(1);
    expect(cenario.avisos(menor.id)).toEqual(["INSCRICAO_ATUALIZADA"]);
    expect(cenario.avisos(olheiro.id)).toEqual(["NOVA_INSCRICAO"]);
    expect((await alterar(ana, id, "RECUSADA")).body.erro.codigo).toBe("INSCRICAO_ENCERRADA");
    expect((await cenario.como(ana).get("/perfil/inscricoes")).body.total).toBe(0);
  });

  it("responsável de outro atleta não mexe na inscrição", async () => {
    const estranho = await cenario.cadastrar("atletas", {
      nome: "Pessoa Estranha",
      email: "estranha@exemplo.com",
    });
    cenario.memoria.usuarios.find((u) => u.id === estranho.id)!.tipo = "RESPONSAVEL";
    const token = (await cenario.entrar("estranha@exemplo.com")).body.accessToken;
    cenario.memoria.responsaveis.set(menor.id, [RESPONSAVEL.id]);
    const { id } = (await participar(menor, cenario.avaliacao(olheiro).id)).body;

    expect((await alterar({ id: estranho.id, token }, id, "CONFIRMADA")).status).toBe(404);
  });
});

describe("GET /avaliacoes/:id/inscricoes (RF-44)", () => {
  it("lista os participantes com idade e busca pelo nome; só para o dono", async () => {
    cenario.memoria.responsaveis.set(menor.id, [RESPONSAVEL.id]);
    const peneira = cenario.avaliacao(olheiro);
    await participar(adulto, peneira.id);
    await participar(menor, peneira.id);

    const todos = await cenario.como(olheiro).get(`/avaliacoes/${peneira.id}/inscricoes`);
    expect(todos.body.dados.map((p: { atleta: { nome: string } }) => p.atleta.nome)).toEqual([
      "Matheus Lima",
      "Silas Rodrigues",
    ]);
    expect(todos.body.dados[0]).toMatchObject({
      status: "AGUARDANDO_RESPONSAVEL",
      atleta: { posicoes: ["MEI", "ATA"], uf: "SP" },
    });
    expect(typeof todos.body.dados[0].atleta.idade).toBe("number");

    const busca = await cenario
      .como(olheiro)
      .get(`/avaliacoes/${peneira.id}/inscricoes?busca=silas`);
    expect(busca.body.total).toBe(1);

    const outro = await cenario.olheiro("Carla Mendes", "carla@exemplo.com");
    cenario.memoria.olheirosVerificados.add(outro.id);
    expect((await cenario.como(outro).get(`/avaliacoes/${peneira.id}/inscricoes`)).status).toBe(
      403,
    );
  });
});
