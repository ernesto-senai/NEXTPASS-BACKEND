import type {
  StatusInscricao,
  StatusUsuario,
  TipoUsuario,
} from "../../src/generated/prisma/enums.ts";
import type { Adaptadores } from "../../src/main/dependencias.ts";
import { criarEmissorTokens } from "../../src/modules/auth/infra/emissor-tokens.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import type { LanceDoFeed } from "../../src/modules/videos/domain/lance.ts";
import { intervalo, type Paginacao } from "../../src/shared/domain/pagina.ts";

interface UsuarioMemoria {
  id: string;
  nome: string;
  email: string;
  senhaHash: string | null;
  tipo: TipoUsuario;
  status: StatusUsuario;
  olheiro?: { telefone: string; atuacao: string; clube: string | null };
}

interface TokenMemoria {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

interface InscricaoMemoria {
  id: string;
  atletaId: string;
  avaliacaoId: string;
  status: StatusInscricao;
}

const paginar = <T>(lista: T[], paginacao: Paginacao) => {
  const { skip, take } = intervalo(paginacao);
  return { dados: lista.slice(skip, skip + take), total: lista.length };
};

// Adaptadores sem banco para testar casos de uso e rotas. O hasher é trivial
// para os testes rodarem rápido; o emissor de tokens é o real.
export function criarAdaptadoresEmMemoria() {
  const usuarios: UsuarioMemoria[] = [];
  const tokens: TokenMemoria[] = [];
  const avaliacoes: AvaliacaoResumo[] = [];
  const inscricoes: InscricaoMemoria[] = [];
  const lances: Omit<LanceDoFeed, "visualizacoes">[] = [];
  const visualizacoes: { videoId: string; olheiroId: string }[] = [];
  const olheirosVerificados = new Set<string>();
  let sequencia = 0;
  const novoId = () => `id-${++sequencia}`;

  const criar = (dados: Omit<UsuarioMemoria, "id" | "status">) => {
    if (usuarios.some((u) => u.email === dados.email)) return Promise.resolve(null);
    const usuario = { ...dados, id: novoId(), status: "ATIVO" as const };
    usuarios.push(usuario);
    return Promise.resolve({ id: usuario.id, nome: usuario.nome, tipo: usuario.tipo });
  };

  const adaptadores: Adaptadores = {
    hasher: {
      gerar: async (valor) => `hash:${valor}`,
      comparar: async (valor, hash) => hash === `hash:${valor}`,
    },
    tokens: criarEmissorTokens({
      segredo: "segredo-de-acesso-apenas-para-testes-000",
      expiraEm: "15m",
    }),

    contas: {
      buscarPorEmail: async (email) => usuarios.find((u) => u.email === email) ?? null,
      buscarPorId: async (id) => usuarios.find((u) => u.id === id) ?? null,
    },

    usuarios: {
      emailEmUso: async (email) => usuarios.some((u) => u.email === email),
      criarAtleta: ({ nome, email, senhaHash }) =>
        criar({ nome, email, senhaHash, tipo: "ATLETA" }),
      criarOlheiro: ({ nome, email, senhaHash, telefone, atuacao, clube }) =>
        criar({ nome, email, senhaHash, tipo: "OLHEIRO", olheiro: { telefone, atuacao, clube } }),
    },

    refreshTokens: {
      salvar: async (dados) => {
        tokens.push({ ...dados, id: novoId(), usadoEm: null });
      },
      buscarValido: async (tokenHash, agora) =>
        tokens.find((t) => t.tokenHash === tokenHash && !t.usadoEm && t.expiraEm > agora) ?? null,
      revogar: async (id, agora) => {
        const token = tokens.find((t) => t.id === id && !t.usadoEm);
        if (token) token.usadoEm = agora;
        return !!token;
      },
    },

    avaliacoes: {
      listarFuturas: async (paginacao, agora) =>
        paginar(
          avaliacoes
            .filter((a) => a.dataHora > agora && ["ABERTA", "ESGOTADA"].includes(a.status))
            .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime()),
          paginacao,
        ),
    },

    inscricoes: {
      listarDoAtleta: async (atletaId, situacao, paginacao, agora) => {
        const lista = inscricoes
          .filter((i) => i.atletaId === atletaId)
          .map((i) => ({
            id: i.id,
            status: i.status,
            avaliacao: avaliacoes.find((a) => a.id === i.avaliacaoId)!,
          }))
          .filter(({ status, avaliacao }) =>
            situacao === "ativas"
              ? ["AGUARDANDO_RESPONSAVEL", "CONFIRMADA"].includes(status) &&
                avaliacao.dataHora > agora
              : status === "CONFIRMADA" && avaliacao.dataHora <= agora,
          );
        return paginar(lista, paginacao);
      },
    },

    lances: {
      listarFeed: async (paginacao) =>
        paginar(
          [...lances]
            .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
            .map((l) => ({
              ...l,
              visualizacoes: visualizacoes.filter((v) => v.videoId === l.id).length,
            })),
          paginacao,
        ),
      existe: async (id) => lances.some((l) => l.id === id),
      registrarVisualizacao: async (videoId, olheiroId) => {
        visualizacoes.push({ videoId, olheiroId });
      },
    },

    olheiroVerificado: async (usuarioId) => olheirosVerificados.has(usuarioId),
  };

  return {
    adaptadores,
    usuarios,
    tokens,
    avaliacoes,
    inscricoes,
    lances,
    visualizacoes,
    olheirosVerificados,
  };
}
