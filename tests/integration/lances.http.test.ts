import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";
import { videoMp4 } from "../support/video-mp4.ts";

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

const publicar = (
  token: string,
  video: { conteudo: Buffer; tipo?: string },
  campos: Record<string, string> = {},
) => {
  const envio = request(app).post("/api/v1/videos").set("Authorization", `Bearer ${token}`);
  for (const [nome, valor] of Object.entries(campos)) envio.field(nome, valor);
  return envio.attach("video", video.conteudo, {
    filename: "lance.mp4",
    contentType: video.tipo ?? "video/mp4",
  });
};

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

describe("POST /videos (RF-25)", () => {
  it("publica o lance com legenda e localização, e ele entra no feed", async () => {
    const resposta = await publicar(
      atleta.token,
      { conteudo: videoMp4(45) },
      { legenda: "  Drible e finalização ", localizacao: "São Paulo - SP" },
    );

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      duracaoSeg: 45,
      legenda: "Drible e finalização",
      localizacao: "São Paulo - SP",
      destaque: false,
    });
    expect(memoria.arquivos.has(resposta.body.url)).toBe(true);

    memoria.olheirosVerificados.add(olheiro.id);
    const feed = await request(app)
      .get("/api/v1/videos")
      .set("Authorization", `Bearer ${olheiro.token}`);
    expect(feed.body.dados[0]).toMatchObject({
      id: resposta.body.id,
      atleta: { id: atleta.id, nome: "Silas Rodrigues" },
    });
  });

  it("aceita lance sem legenda nem localização, e MOV do iPhone", async () => {
    const resposta = await publicar(atleta.token, {
      conteudo: videoMp4(30, { versao: 1 }),
      tipo: "video/quicktime",
    });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ legenda: null, localizacao: null });
    expect(resposta.body.url).toMatch(/\.mov$/);
  });

  it("recusa vídeo fora de 30 a 60 segundos (RN-09)", async () => {
    for (const segundos of [20, 61]) {
      const resposta = await publicar(atleta.token, { conteudo: videoMp4(segundos) });
      expect(resposta.status).toBe(422);
      expect(resposta.body.erro.codigo).toBe("DURACAO_VIDEO_INVALIDA");
    }
    expect(memoria.arquivos.size).toBe(0);
  });

  it("recusa arquivo que não é MP4 ou MOV, ou envio sem vídeo", async () => {
    const texto = await publicar(atleta.token, {
      conteudo: Buffer.from("olá"),
      tipo: "text/plain",
    });
    const disfarcado = await publicar(atleta.token, { conteudo: Buffer.from("não sou vídeo") });
    const semVideo = await request(app)
      .post("/api/v1/videos")
      .set("Authorization", `Bearer ${atleta.token}`)
      .field("legenda", "Sem vídeo");

    for (const resposta of [texto, disfarcado, semVideo]) {
      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe("DADOS_INVALIDOS");
    }
  });

  it("só o atleta publica lances", async () => {
    const resposta = await publicar(olheiro.token, { conteudo: videoMp4(45) });

    expect(resposta.status).toBe(403);
    expect(resposta.body.erro.codigo).toBe("ACESSO_NEGADO");
  });
});

describe("Meus lances (RF-28, RF-30, RF-31)", () => {
  const meus = (token: string) =>
    request(app).get("/api/v1/perfil/videos").set("Authorization", `Bearer ${token}`);
  const editar = (token: string, id: string, dados: object) =>
    request(app).patch(`/api/v1/videos/${id}`).set("Authorization", `Bearer ${token}`).send(dados);
  const excluir = (token: string, id: string) =>
    request(app).delete(`/api/v1/videos/${id}`).set("Authorization", `Bearer ${token}`);

  async function publicarVarios(quantidade: number) {
    const ids: string[] = [];
    for (let i = 1; i <= quantidade; i++) {
      const resposta = await publicar(
        atleta.token,
        { conteudo: videoMp4(30 + i) },
        { legenda: `Lance ${i}` },
      );
      ids.push(resposta.body.id);
    }
    return ids;
  }

  it("lista os lances do atleta, com os destaques primeiro (até 3)", async () => {
    const [primeiro, segundo, terceiro, quarto] = await publicarVarios(4);

    for (const id of [primeiro!, segundo!, terceiro!]) {
      expect((await editar(atleta.token, id, { destaque: true })).status).toBe(200);
    }
    const quartoDestaque = await editar(atleta.token, quarto!, { destaque: true });
    expect(quartoDestaque.status).toBe(422);
    expect(quartoDestaque.body.erro.codigo).toBe("LIMITE_DESTAQUES");

    const { body } = await meus(atleta.token);
    expect(body.total).toBe(4);
    expect(body.dados.map((l: { legenda: string }) => l.legenda)).toEqual([
      "Lance 3",
      "Lance 2",
      "Lance 1",
      "Lance 4",
    ]);
  });

  it("edita a legenda (vazia apaga) e exclui o lance com o arquivo", async () => {
    const [id] = await publicarVarios(1);
    const { url } = (await meus(atleta.token)).body.dados[0];

    const editado = await editar(atleta.token, id!, { legenda: "  " });
    expect(editado.body.legenda).toBeNull();

    expect((await excluir(atleta.token, id!)).status).toBe(204);
    expect((await meus(atleta.token)).body.total).toBe(0);
    expect(memoria.arquivos.has(url)).toBe(false);
  });

  it("só o dono edita ou exclui", async () => {
    const [id] = await publicarVarios(1);
    const outro = await cadastrar("atletas", { nome: "Leandro", email: "leandro@exemplo.com" });

    expect((await editar(outro.token, id!, { destaque: true })).status).toBe(404);
    expect((await excluir(outro.token, id!)).status).toBe(404);
    expect((await meus(atleta.token)).body.total).toBe(1);
  });
});
