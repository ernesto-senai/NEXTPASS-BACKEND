import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;

beforeEach(() => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));
});

const atleta = {
  nome: "Silas Rodrigues",
  email: "Silas@Exemplo.com ",
  senha: "senha-segura",
  aceiteTermos: true,
};

const olheiro = {
  nome: "Fabrizio Romano",
  email: "fabrizio@exemplo.com",
  senha: "senha-segura",
  telefone: "+55 (11) 91234-5678",
  atuacao: "CLUBE",
  clube: "Palmeiras",
  aceiteTermos: true,
};

describe("POST /atletas", () => {
  it("cria a conta e já devolve a sessão", async () => {
    const resposta = await request(app).post("/api/v1/atletas").send(atleta);

    expect(resposta.status).toBe(201);
    expect(resposta.body.usuario).toMatchObject({ nome: "Silas Rodrigues", tipo: "ATLETA" });
    expect(resposta.body.accessToken).toBeTruthy();
    expect(memoria.usuarios[0]?.email).toBe("silas@exemplo.com");
  });

  it("exige o aceite dos termos e senha com 8 caracteres", async () => {
    const resposta = await request(app)
      .post("/api/v1/atletas")
      .send({ ...atleta, senha: "curta", aceiteTermos: false });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe("DADOS_INVALIDOS");
    expect(Object.keys(resposta.body.erro.campos)).toEqual(["senha", "aceiteTermos"]);
  });

  it("responde 409 para e-mail já cadastrado", async () => {
    await request(app).post("/api/v1/atletas").send(atleta);
    const resposta = await request(app).post("/api/v1/atletas").send(atleta);

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro.codigo).toBe("EMAIL_JA_CADASTRADO");
  });
});

describe("POST /olheiros", () => {
  it("normaliza o telefone", async () => {
    const resposta = await request(app).post("/api/v1/olheiros").send(olheiro);

    expect(resposta.status).toBe(201);
    expect(memoria.usuarios[0]?.olheiro?.telefone).toBe("+5511912345678");
  });

  it("pede o clube quando a atuação é por clube", async () => {
    const resposta = await request(app)
      .post("/api/v1/olheiros")
      .send({ ...olheiro, clube: undefined });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.campos.clube).toEqual(["Informe o clube em que você atua."]);
  });
});

describe("autenticação", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/atletas").send(atleta);
  });

  const login = (senha: string) =>
    request(app).post("/api/v1/auth/login").send({ email: "silas@exemplo.com", senha });

  it("faz login, renova e encerra a sessão", async () => {
    const entrada = await login("senha-segura");
    expect(entrada.status).toBe(200);

    const renovada = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: entrada.body.refreshToken });
    expect(renovada.status).toBe(200);

    const saida = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${renovada.body.accessToken}`)
      .send({ refreshToken: renovada.body.refreshToken });
    expect(saida.status).toBe(204);

    const depoisDoLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: renovada.body.refreshToken });
    expect(depoisDoLogout.status).toBe(401);
  });

  it("bloqueia após 5 tentativas erradas (RNF-08)", async () => {
    for (let i = 0; i < 5; i++) expect((await login("errada")).status).toBe(401);

    const bloqueada = await login("senha-segura");

    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.erro.codigo).toBe("MUITAS_TENTATIVAS");
  });

  it("exige token para sair da conta", async () => {
    const resposta = await request(app).post("/api/v1/auth/logout").send({ refreshToken: "x" });

    expect(resposta.status).toBe(401);
  });
});

describe("GET /termos", () => {
  it("devolve os termos vigentes", async () => {
    const resposta = await request(app).get("/api/v1/termos");

    expect(resposta.status).toBe(200);
    expect(resposta.body.versao).toBeTruthy();
  });
});
