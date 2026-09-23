import { beforeEach, describe, expect, it } from "vitest";
import { montarDependencias } from "../../../../src/main/dependencias.ts";
import { criarAdaptadoresEmMemoria } from "../../../support/adaptadores-em-memoria.ts";

let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let deps: ReturnType<typeof montarDependencias>;

beforeEach(() => {
  memoria = criarAdaptadoresEmMemoria();
  deps = montarDependencias(memoria.adaptadores);
});

const atleta = { nome: "Silas Rodrigues", email: "silas@exemplo.com", senha: "senha-segura" };

describe("cadastrarAtleta (RF-08)", () => {
  it("cria o atleta com a senha em hash", async () => {
    const criado = await deps.usuarios.cadastrarAtleta(atleta);

    expect(criado).toMatchObject({ nome: "Silas Rodrigues", tipo: "ATLETA" });
    expect(memoria.usuarios[0]?.senhaHash).not.toBe("senha-segura");
  });

  it("recusa e-mail já cadastrado", async () => {
    await deps.usuarios.cadastrarAtleta(atleta);

    await expect(deps.usuarios.cadastrarAtleta(atleta)).rejects.toMatchObject({
      codigo: "EMAIL_JA_CADASTRADO",
    });
  });
});

describe("cadastrarOlheiro (RF-09)", () => {
  const olheiro = {
    nome: "Fabrizio Romano",
    email: "fabrizio@exemplo.com",
    senha: "senha-segura",
    telefone: "+5511912345678",
  };

  it("guarda o clube só para quem atua por clube", async () => {
    await deps.usuarios.cadastrarOlheiro({ ...olheiro, atuacao: "CLUBE", clube: "Palmeiras" });
    await deps.usuarios.cadastrarOlheiro({
      ...olheiro,
      email: "independente@exemplo.com",
      atuacao: "INDEPENDENTE",
      clube: "Ignorado",
    });

    expect(memoria.usuarios.map((u) => u.olheiro?.clube)).toEqual(["Palmeiras", null]);
  });
});
