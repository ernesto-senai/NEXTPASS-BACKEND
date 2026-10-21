import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario, daqui } from "../support/cenario.ts";
import { videoMp4 } from "../support/video-mp4.ts";

let cenario: ReturnType<typeof criarCenario>;
let atleta: Conta;
let olheiro: Conta;

beforeEach(async () => {
  cenario = criarCenario();
  atleta = await cenario.atleta("Silas Rodrigues", "silas@exemplo.com");
  olheiro = await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
  cenario.memoria.olheirosVerificados.add(olheiro.id);
});

describe("GET /atletas/:id (RF-38, RF-45)", () => {
  it("mostra a ficha técnica e até 3 lances, os destaques primeiro", async () => {
    cenario.completarPerfil(atleta, "Silas Rodrigues", "2009-05-10");
    const ids: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const lance = await cenario
        .como(atleta)
        .post("/videos")
        .field("legenda", `Lance ${i}`)
        .attach("video", videoMp4(40), { filename: "lance.mp4", contentType: "video/mp4" });
      ids.push(lance.body.id);
    }
    await cenario.como(atleta).patch(`/videos/${ids[0]}`, { destaque: true });

    const resposta = await cenario.como(olheiro).get(`/atletas/${atleta.id}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      nome: "Silas Rodrigues",
      posicoes: ["MEI", "ATA"],
      alturaCm: 176,
      totalLances: 4,
    });
    expect(typeof resposta.body.idade).toBe("number");
    expect(resposta.body.lances.map((l: { legenda: string }) => l.legenda)).toEqual([
      "Lance 1",
      "Lance 4",
      "Lance 3",
    ]);
  });

  it("perfil incompleto não aparece e o olheiro precisa estar verificado (RN-02, RN-04)", async () => {
    expect((await cenario.como(olheiro).get(`/atletas/${atleta.id}`)).status).toBe(404);

    cenario.memoria.olheirosVerificados.clear();
    cenario.completarPerfil(atleta, "Silas Rodrigues", "2009-05-10");
    expect((await cenario.como(olheiro).get(`/atletas/${atleta.id}`)).status).toBe(403);
  });
});

describe("PATCH /avaliacoes/:id (RF-43)", () => {
  const dados = (extra: object = {}) => ({
    nome: "Peneira Sub-17 (nova data)",
    tipo: "PENEIRA",
    categoria: "SUB_17",
    posicoes: ["ATA"],
    requisitos: "Chuteira e documento",
    taxaCentavos: 0,
    vagas: 20,
    dataHora: daqui(14).toISOString(),
    local: "CT da Barra Funda",
    endereco: "Rua Dr. Moraes Sales, 1000",
    cidade: "São Paulo",
    uf: "SP",
    ...extra,
  });

  it("edita a avaliação e avisa os inscritos", async () => {
    cenario.completarPerfil(atleta, "Silas Rodrigues", "2000-01-01");
    const peneira = cenario.avaliacao(olheiro);
    await cenario.como(atleta).post(`/avaliacoes/${peneira.id}/inscricoes`);

    const resposta = await cenario.como(olheiro).patch(`/avaliacoes/${peneira.id}`, dados());

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ nome: "Peneira Sub-17 (nova data)", vagas: 20 });
    expect(cenario.avisos(atleta.id)).toEqual(["AVALIACAO_ALTERADA"]);
  });

  it("não deixa o limite de vagas abaixo dos confirmados; só o dono edita", async () => {
    cenario.completarPerfil(atleta, "Silas Rodrigues", "2000-01-01");
    const peneira = cenario.avaliacao(olheiro);
    await cenario.como(atleta).post(`/avaliacoes/${peneira.id}/inscricoes`);
    const outro = await cenario.olheiro("Carla Mendes", "carla@exemplo.com");
    cenario.memoria.olheirosVerificados.add(outro.id);

    const poucasVagas = await cenario
      .como(olheiro)
      .patch(`/avaliacoes/${peneira.id}`, dados({ vagas: 0 }));
    expect(poucasVagas.status).toBe(400);
    const umaVaga = await cenario
      .como(olheiro)
      .patch(`/avaliacoes/${peneira.id}`, dados({ vagas: 1 }));
    expect(umaVaga.body.status).toBe("ESGOTADA");
    expect((await cenario.como(outro).patch(`/avaliacoes/${peneira.id}`, dados())).status).toBe(
      403,
    );
  });
});
