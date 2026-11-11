import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import type { AtletaPerfil } from "../../src/modules/atletas/domain/atleta.ts";
import { criarAdaptadoresEmMemoria } from "../support/adaptadores-em-memoria.ts";

let app: ReturnType<typeof createApp>;
let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let tokenOlheiro: string;
let tokenAtleta: string;

const anoAtual = new Date().getUTCFullYear();

function atleta(dados: Partial<AtletaPerfil>) {
  memoria.atletas.push({
    id: `atleta-${memoria.atletas.length + 1}`,
    nome: "Atleta",
    fotoUrl: null,
    posicoes: ["MEI"],
    dataNascimento: new Date(Date.UTC(anoAtual - 17, 0, 15)),
    cidade: "São Paulo",
    uf: "SP",
    nacionalidade: "Brasileira",
    alturaCm: 175,
    pesoKg: 68,
    pePreferencial: "DESTRO",
    ...dados,
  });
}

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  app = createApp(montarDependencias(memoria.adaptadores));

  const olheiro = await request(app).post("/api/v1/olheiros").send({
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    senha: "senha-segura",
    telefone: "11912345678",
    atuacao: "INDEPENDENTE",
    aceiteTermos: true,
  });
  tokenOlheiro = olheiro.body.accessToken;
  memoria.olheirosVerificados.add(olheiro.body.usuario.id);

  const atletaLogado = await request(app).post("/api/v1/atletas").send({
    nome: "Silas Rodrigues",
    email: "silas@exemplo.com",
    senha: "senha-segura",
    aceiteTermos: true,
  });
  tokenAtleta = atletaLogado.body.accessToken;
});

const buscar = (query = "", token = tokenOlheiro) =>
  request(app).get(`/api/v1/atletas?${query}`).set("Authorization", `Bearer ${token}`);

describe("GET /atletas (RF-35 a RF-37)", () => {
  it("devolve idade e categoria calculadas pela data de nascimento (RN-01)", async () => {
    atleta({ nome: "Matheus Lima", dataNascimento: new Date(Date.UTC(anoAtual - 17, 0, 15)) });

    const resposta = await buscar();

    expect(resposta.status).toBe(200);
    expect(resposta.body.dados[0]).toMatchObject({
      nome: "Matheus Lima",
      idade: 17,
      categoria: "SUB_17",
    });
    expect(resposta.body.dados[0]).not.toHaveProperty("dataNascimento");
  });

  it("filtra por categoria, posição e pé, e ordena pelos mais altos", async () => {
    atleta({ nome: "Baixo", alturaCm: 165, posicoes: ["ATA"] });
    atleta({ nome: "Alto", alturaCm: 188, posicoes: ["ATA"] });
    atleta({ nome: "Canhoto", posicoes: ["ATA"], pePreferencial: "CANHOTO" });
    atleta({ nome: "Goleiro", posicoes: ["GOL"] });
    atleta({
      nome: "Adulto",
      posicoes: ["ATA"],
      dataNascimento: new Date(Date.UTC(anoAtual - 25, 0, 15)),
    });

    const resposta = await buscar("categoria=SUB_17&posicoes=ATA,PE&pe=DESTRO&ordenar=maisAltos");

    expect(resposta.body.dados.map((a: AtletaPerfil) => a.nome)).toEqual(["Alto", "Baixo"]);
  });

  it("filtra por faixa de idade", async () => {
    atleta({ nome: "Quinze", dataNascimento: new Date(Date.UTC(anoAtual - 15, 0, 1)) });
    atleta({ nome: "Vinte", dataNascimento: new Date(Date.UTC(anoAtual - 20, 0, 1)) });

    const resposta = await buscar("idadeMin=14&idadeMax=16");

    expect(resposta.body.dados.map((a: AtletaPerfil) => a.nome)).toEqual(["Quinze"]);
  });

  it("é exclusiva do olheiro verificado (RN-04)", async () => {
    const naoVerificado = await request(app).post("/api/v1/olheiros").send({
      nome: "Olheiro Novo",
      email: "novo@exemplo.com",
      senha: "senha-segura",
      telefone: "11912345678",
      atuacao: "INDEPENDENTE",
      aceiteTermos: true,
    });

    expect((await buscar("", naoVerificado.body.accessToken)).body.erro.codigo).toBe(
      "OLHEIRO_NAO_VERIFICADO",
    );
    expect((await buscar("", tokenAtleta)).status).toBe(403);
  });
});
