import { beforeEach, describe, expect, it } from "vitest";
import { montarDependencias } from "../../../../src/main/dependencias.ts";
import { DURACAO_SESSAO_MS } from "../../../../src/modules/auth/domain/sessao.ts";
import { criarAdaptadoresEmMemoria } from "../../../support/adaptadores-em-memoria.ts";

let memoria: ReturnType<typeof criarAdaptadoresEmMemoria>;
let deps: ReturnType<typeof montarDependencias>;

beforeEach(async () => {
  memoria = criarAdaptadoresEmMemoria();
  deps = montarDependencias(memoria.adaptadores);
  await deps.usuarios.cadastrarAtleta({
    nome: "Silas Rodrigues",
    email: "silas@exemplo.com",
    senha: "senha-segura",
  });
});

const entrar = (senha = "senha-segura", lembrar = false) =>
  deps.auth.fazerLogin({ email: "silas@exemplo.com", senha, lembrar });

describe("fazerLogin (RF-01)", () => {
  it("devolve o usuário e os dois tokens", async () => {
    const sessao = await entrar();

    expect(sessao.usuario).toMatchObject({ nome: "Silas Rodrigues", tipo: "ATLETA" });
    expect(sessao.accessToken).toBeTruthy();
    expect(sessao.refreshToken).toBeTruthy();
  });

  it("guarda só o hash do token de atualização (RNF-07)", async () => {
    const { refreshToken } = await entrar();

    expect(memoria.tokens[0]?.tokenHash).not.toBe(refreshToken);
  });

  it("usa a mesma mensagem para senha errada e e-mail inexistente", async () => {
    await expect(entrar("senha-errada")).rejects.toMatchObject({ codigo: "CREDENCIAIS_INVALIDAS" });
    await expect(
      deps.auth.fazerLogin({ email: "ninguem@exemplo.com", senha: "x", lembrar: false }),
    ).rejects.toMatchObject({ codigo: "CREDENCIAIS_INVALIDAS" });
  });

  it("bloqueia conta suspensa", async () => {
    memoria.usuarios[0]!.status = "SUSPENSO";

    await expect(entrar()).rejects.toMatchObject({ codigo: "CONTA_SUSPENSA" });
  });

  it("estende a sessão com Lembrar de mim (RF-03)", async () => {
    await entrar("senha-segura", false);
    await entrar("senha-segura", true);
    const [curta, longa] = memoria.tokens;

    const diferenca = longa!.expiraEm.getTime() - curta!.expiraEm.getTime();
    expect(diferenca).toBeGreaterThan(DURACAO_SESSAO_MS.lembrar - DURACAO_SESSAO_MS.padrao - 1000);
  });
});

describe("renovarSessao (RF-03)", () => {
  it("troca o token de atualização e invalida o antigo", async () => {
    const { refreshToken } = await entrar();

    const nova = await deps.auth.renovarSessao(refreshToken);

    expect(nova.refreshToken).not.toBe(refreshToken);
    await expect(deps.auth.renovarSessao(refreshToken)).rejects.toMatchObject({
      codigo: "TOKEN_INVALIDO",
    });
  });

  it("mantém a validade original da sessão", async () => {
    const { refreshToken } = await entrar();
    await deps.auth.renovarSessao(refreshToken);

    expect(memoria.tokens[1]?.expiraEm).toEqual(memoria.tokens[0]?.expiraEm);
  });
});

describe("encerrarSessao (RF-55)", () => {
  it("invalida o token de atualização do aparelho", async () => {
    const { usuario, refreshToken } = await entrar();

    await deps.auth.encerrarSessao(refreshToken, usuario.id);

    await expect(deps.auth.renovarSessao(refreshToken)).rejects.toMatchObject({
      codigo: "TOKEN_INVALIDO",
    });
  });
});
