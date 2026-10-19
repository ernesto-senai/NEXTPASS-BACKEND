import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let olheiro: { id: string; token: string };
let atleta: { id: string; token: string };

async function cadastrar(rota: string, dados: object) {
  const resposta = await request(app)
    .post(`/api/v1/${rota}`)
    .send({ senha: "senha-segura", aceiteTermos: true, ...dados });
  return { id: resposta.body.usuario.id as string, token: resposta.body.accessToken as string };
}

const listar = (token: string) =>
  request(app).get("/api/v1/notificacoes").set("Authorization", `Bearer ${token}`);

const marcar = (token: string, corpo?: object) =>
  request(app).patch("/api/v1/notificacoes").set("Authorization", `Bearer ${token}`).send(corpo);

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
  olheiro = await cadastrar("olheiros", {
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    telefone: "11912345678",
    atuacao: "INDEPENDENTE",
  });
  atleta = await cadastrar("atletas", { nome: "Silas Rodrigues", email: "silas@exemplo.com" });

  await memoria.adaptadores.notificacoes.criar([
    { usuarioId: olheiro.id, tipo: "CONVITE_RESPONDIDO", texto: "Silas aceitou o convite." },
    { usuarioId: olheiro.id, tipo: "NOVA_INSCRICAO", texto: "Leandro se inscreveu." },
    { usuarioId: atleta.id, tipo: "NOVO_CONVITE", texto: "Você recebeu um convite." },
  ]);
});

describe("Notificações (RF-47, RF-52)", () => {
  it("lista só as do usuário, da mais recente para a mais antiga", async () => {
    const resposta = await listar(olheiro.token);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ total: 2, pagina: 1, naoLidas: 2 });
    expect(resposta.body.dados.map((n: { texto: string }) => n.texto)).toEqual([
      "Leandro se inscreveu.",
      "Silas aceitou o convite.",
    ]);
  });

  it("marca uma a uma ou todas como lidas, sem mexer nas de outros usuários", async () => {
    const [recente] = (await listar(olheiro.token)).body.dados;

    expect((await marcar(olheiro.token, { ids: [recente.id] })).status).toBe(204);
    expect((await listar(olheiro.token)).body.naoLidas).toBe(1);

    expect((await marcar(olheiro.token)).status).toBe(204);
    expect((await listar(olheiro.token)).body.naoLidas).toBe(0);
    expect((await listar(atleta.token)).body.naoLidas).toBe(1);
  });

  it("recusa ids inválidos", async () => {
    expect((await marcar(olheiro.token, { ids: ["nao-e-id"] })).status).toBe(400);
  });
});
