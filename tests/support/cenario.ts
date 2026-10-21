import request from "supertest";
import { createApp } from "../../src/main/app.ts";
import { montarDependencias } from "../../src/main/dependencias.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import { criarAdaptadoresEmMemoria } from "./adaptadores-em-memoria.ts";

const DIA = 24 * 60 * 60 * 1000;
export const daqui = (dias: number) => new Date(Date.now() + dias * DIA);

export interface Conta {
  id: string;
  token: string;
}

// App com adaptadores em memória e atalhos para montar cada teste: contas,
// perfis completos, avaliações e requisições já autenticadas.
export function criarCenario() {
  const memoria = criarAdaptadoresEmMemoria();
  const app = createApp(montarDependencias(memoria.adaptadores));

  async function cadastrar(rota: string, dados: object): Promise<Conta> {
    const resposta = await request(app)
      .post(`/api/v1/${rota}`)
      .send({ senha: "senha-segura", aceiteTermos: true, ...dados });
    return { id: resposta.body.usuario.id, token: resposta.body.accessToken };
  }

  async function entrar(email: string, senha = "senha-segura") {
    return request(app).post("/api/v1/auth/login").send({ email, senha });
  }

  // Requisições com o token da conta (ou sem token, se null).
  const como = (conta: Conta | null) => {
    const autenticar = (requisicao: request.Test) =>
      conta ? requisicao.set("Authorization", `Bearer ${conta.token}`) : requisicao;
    return {
      get: (caminho: string) => autenticar(request(app).get(`/api/v1${caminho}`)),
      post: (caminho: string, corpo?: object) =>
        autenticar(request(app).post(`/api/v1${caminho}`)).send(corpo),
      patch: (caminho: string, corpo?: object) =>
        autenticar(request(app).patch(`/api/v1${caminho}`)).send(corpo),
      delete: (caminho: string, corpo?: object) =>
        autenticar(request(app).delete(`/api/v1${caminho}`)).send(corpo),
    };
  };

  const atleta = (nome: string, email: string) => cadastrar("atletas", { nome, email });

  const olheiro = (nome: string, email: string, dados: object = {}) =>
    cadastrar("olheiros", {
      nome,
      email,
      telefone: "11912345678",
      atuacao: "INDEPENDENTE",
      ...dados,
    });

  // Administrador: criado direto no "banco", como faz o seed.
  async function admin(): Promise<Conta> {
    memoria.usuarios.push({
      id: "0199a1b2-0000-7000-8000-00000000ad01",
      nome: "Equipe NextPass",
      email: "admin@nextpass.app",
      senhaHash: "hash:senha-segura",
      tipo: "ADMIN",
      status: "ATIVO",
    });
    const resposta = await entrar("admin@nextpass.app");
    return { id: "0199a1b2-0000-7000-8000-00000000ad01", token: resposta.body.accessToken };
  }

  // Perfil técnico completo (RN-02), como o atleta preenche em Editar perfil.
  function completarPerfil(conta: Conta, nome: string, dataNascimento: string) {
    memoria.atletas.push({
      id: conta.id,
      nome,
      fotoUrl: null,
      posicoes: ["MEI", "ATA"],
      cidade: "São Paulo",
      uf: "SP",
      nacionalidade: "Brasileira",
      alturaCm: 176,
      pesoKg: 68,
      pePreferencial: "DESTRO",
      dataNascimento: new Date(dataNascimento),
    });
  }

  function avaliacao(dono: Conta & { nome?: string }, dados: Partial<AvaliacaoResumo> = {}) {
    const nova: AvaliacaoResumo = {
      id: `0199a1b2-0000-7000-8000-${String(memoria.avaliacoes.length + 1).padStart(12, "0")}`,
      nome: "Peneira Sub-17",
      tipo: "PENEIRA",
      categoria: "SUB_17",
      posicoes: ["ATA"],
      dataHora: daqui(7),
      local: "CT da Barra Funda",
      cidade: "São Paulo",
      uf: "SP",
      taxaCentavos: 0,
      vagas: 10,
      vagasOcupadas: 0,
      status: "ABERTA",
      clube: null,
      olheiro: { id: dono.id, nome: dono.nome ?? "Fabrizio Romano" },
      ...dados,
    };
    memoria.avaliacoes.push(nova);
    return nova;
  }

  const avisos = (usuarioId: string) =>
    memoria.notificacoes.filter((n) => n.usuarioId === usuarioId).map((n) => n.tipo);

  return {
    app,
    memoria,
    cadastrar,
    entrar,
    como,
    atleta,
    olheiro,
    admin,
    completarPerfil,
    avaliacao,
    avisos,
  };
}
