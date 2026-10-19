import type {
  AtuacaoOlheiro,
  StatusConvite,
  StatusInscricao,
  StatusUsuario,
  TipoUsuario,
} from "../../src/generated/prisma/enums.ts";
import type { Adaptadores } from "../../src/main/dependencias.ts";
import type { AtletaPerfil } from "../../src/modules/atletas/domain/atleta.ts";
import { criarEmissorTokens } from "../../src/modules/auth/infra/emissor-tokens.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import type { NovoConvite } from "../../src/modules/convites/domain/convite.ts";
import { STATUS_ATIVOS } from "../../src/modules/inscricoes/domain/inscricao.ts";
import type { Notificacao } from "../../src/modules/notificacoes/domain/notificacao.ts";
import type { LanceDoFeed } from "../../src/modules/videos/domain/lance.ts";
import { intervalo, type Paginacao } from "../../src/shared/domain/pagina.ts";

interface UsuarioMemoria {
  id: string;
  nome: string;
  email: string;
  senhaHash: string | null;
  tipo: TipoUsuario;
  status: StatusUsuario;
  olheiro?: { telefone: string; atuacao: AtuacaoOlheiro; clube: string | null };
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
  conviteId?: string | undefined;
}

interface ConviteMemoria extends NovoConvite {
  id: string;
  status: StatusConvite;
  criadoEm: Date;
  respondidoEm: Date | null;
}

const ativa = (status: StatusInscricao) => STATUS_ATIVOS.some((ativo) => ativo === status);

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
  const lances: (Omit<LanceDoFeed, "visualizacoes"> & { destaque?: boolean })[] = [];
  const visualizacoes: { videoId: string; olheiroId: string }[] = [];
  const olheirosVerificados = new Set<string>();
  // Perfis completos de atletas, como o banco devolve para a busca.
  const atletas: AtletaPerfil[] = [];
  // Arquivos enviados, pela URL devolvida ao app.
  const arquivos = new Map<string, Buffer>();
  const convites: ConviteMemoria[] = [];
  const notificacoes: (Notificacao & { usuarioId: string })[] = [];
  // Responsáveis com vínculo confirmado, por atleta (RN-03).
  const responsaveis = new Map<string, string[]>();
  let sequencia = 0;
  // Ids no formato UUID, como os do banco, para passar na validação das rotas.
  const novoId = () => `00000000-0000-7000-8000-${String(++sequencia).padStart(12, "0")}`;

  // Lance como o dono vê: sem os dados do autor.
  const paraLance = ({ atleta: _atleta, destaque, ...lance }: (typeof lances)[number]) => ({
    ...lance,
    destaque: !!destaque,
  });

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

    perfis: {
      buscar: async (usuarioId) => {
        const usuario = usuarios.find((u) => u.id === usuarioId);
        if (!usuario) return null;
        const perfil = atletas.find((a) => a.id === usuarioId);
        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          fotoUrl: null,
          tipo: usuario.tipo,
          atleta:
            usuario.tipo === "ATLETA"
              ? {
                  dataNascimento: perfil?.dataNascimento ?? null,
                  posicoes: perfil?.posicoes ?? [],
                  alturaCm: perfil?.alturaCm ?? null,
                  pesoKg: perfil?.pesoKg ?? null,
                  pePreferencial: perfil?.pePreferencial ?? null,
                  cidade: perfil?.cidade ?? null,
                  uf: perfil?.uf ?? null,
                  nacionalidade: perfil?.nacionalidade ?? null,
                  responsavel: responsaveis.has(usuarioId) ? "CONFIRMADO" : null,
                }
              : null,
          olheiro: usuario.olheiro
            ? { ...usuario.olheiro, verificado: olheirosVerificados.has(usuarioId) }
            : null,
        };
      },
      atualizarAtleta: async (usuarioId, { nome, ...dados }) => {
        usuarios.find((u) => u.id === usuarioId)!.nome = nome;
        const perfil = { id: usuarioId, nome, fotoUrl: null, ...dados };
        const indice = atletas.findIndex((a) => a.id === usuarioId);
        if (indice >= 0) atletas[indice] = perfil;
        else atletas.push(perfil);
      },
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
      // Guarda só o resumo; requisitos e endereço não aparecem no card.
      criar: async (olheiroId, { requisitos: _requisitos, endereco: _endereco, ...dados }) => {
        const { nome } = usuarios.find((u) => u.id === olheiroId)!;
        const avaliacao: AvaliacaoResumo = {
          ...dados,
          id: novoId(),
          vagasOcupadas: 0,
          status: "ABERTA",
          clube: null,
          olheiro: { id: olheiroId, nome },
        };
        avaliacoes.push(avaliacao);
        return avaliacao;
      },
      listarDoOlheiro: async (olheiroId, situacao, paginacao, agora) => {
        const proxima = (a: AvaliacaoResumo) =>
          ["ABERTA", "ESGOTADA"].includes(a.status) && a.dataHora > agora;
        const lista = avaliacoes
          .filter((a) => a.olheiro.id === olheiroId)
          .filter((a) => (situacao === "proximas" ? proxima(a) : !proxima(a)))
          .sort((a, b) =>
            situacao === "proximas"
              ? a.dataHora.getTime() - b.dataHora.getTime()
              : b.dataHora.getTime() - a.dataHora.getTime(),
          );
        return paginar(lista, paginacao);
      },
      buscarParaDono: async (id) => {
        const avaliacao = avaliacoes.find((a) => a.id === id);
        if (!avaliacao) return null;
        const { nome, status, dataHora, olheiro } = avaliacao;
        return { olheiroId: olheiro.id, nome, status, dataHora };
      },
      cancelar: async (id) => {
        avaliacoes.find((a) => a.id === id)!.status = "CANCELADA";
        const ativas = inscricoes.filter((i) => i.avaliacaoId === id && ativa(i.status));
        for (const inscricao of ativas) inscricao.status = "CANCELADA";
        for (const convite of convites) {
          if (convite.avaliacaoId === id && convite.status === "PENDENTE")
            convite.status = "EXPIRADO";
        }
        return ativas.map((inscricao) => inscricao.atletaId);
      },
      listarFuturas: async (filtro, paginacao, agora) => {
        const contem = (texto: string | null) =>
          !!texto?.toLowerCase().includes(filtro.busca!.toLowerCase());
        const lista = avaliacoes
          .filter((a) => a.dataHora > agora)
          .filter((a) =>
            (filtro.somenteComVagas ? ["ABERTA"] : ["ABERTA", "ESGOTADA"]).includes(a.status),
          )
          .filter((a) => !filtro.busca || contem(a.nome) || contem(a.clube))
          .filter((a) => !filtro.categoria || a.categoria === filtro.categoria)
          .filter((a) => !filtro.tipo || a.tipo === filtro.tipo)
          .filter(
            (a) => !filtro.posicoes?.length || a.posicoes.some((p) => filtro.posicoes!.includes(p)),
          )
          .filter(
            (a) =>
              filtro.precoMaxCentavos === undefined || a.taxaCentavos <= filtro.precoMaxCentavos,
          )
          .sort((a, b) =>
            filtro.ordem === "menorPreco"
              ? a.taxaCentavos - b.taxaCentavos
              : a.dataHora.getTime() - b.dataHora.getTime(),
          );
        return paginar(lista, paginacao);
      },
    },

    inscricoes: {
      atletaParaInscricao: async (atletaId) => {
        const usuario = usuarios.find((u) => u.id === atletaId && u.tipo === "ATLETA");
        if (!usuario) return null;
        const perfil = atletas.find((a) => a.id === atletaId);
        return {
          nome: usuario.nome,
          perfilCompleto: !!perfil,
          dataNascimento: perfil?.dataNascimento ?? null,
          responsaveis: responsaveis.get(atletaId) ?? [],
        };
      },
      inscrever: async ({ atletaId, avaliacaoId, conviteId, status }, agora) => {
        const existente = inscricoes.find(
          (i) => i.atletaId === atletaId && i.avaliacaoId === avaliacaoId,
        );
        if (existente && ativa(existente.status)) return "INSCRICAO_EXISTENTE";
        const avaliacao = avaliacoes.find((a) => a.id === avaliacaoId);
        if (!avaliacao || avaliacao.status !== "ABERTA" || avaliacao.dataHora <= agora) {
          return "SEM_VAGAS";
        }
        if (status === "CONFIRMADA") {
          if (avaliacao.vagasOcupadas >= avaliacao.vagas) return "SEM_VAGAS";
          avaliacao.vagasOcupadas++;
        }

        const inscricao = existente ?? { id: novoId(), atletaId, avaliacaoId, status };
        Object.assign(inscricao, { status, conviteId });
        if (!existente) inscricoes.push(inscricao);
        const convite = convites.find((c) => c.id === conviteId);
        if (convite) Object.assign(convite, { status: "ACEITO", respondidoEm: agora });

        if (avaliacao.vagasOcupadas >= avaliacao.vagas) {
          avaliacao.status = "ESGOTADA";
          for (const pendente of convites) {
            if (pendente.avaliacaoId === avaliacaoId && pendente.status === "PENDENTE") {
              pendente.status = "EXPIRADO";
            }
          }
        }
        return { id: inscricao.id, status, avaliacao: { nome: avaliacao.nome } };
      },
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
      criar: async ({ atletaId, ...dados }) => {
        const { nome } = usuarios.find((u) => u.id === atletaId)!;
        const lance = { ...dados, id: novoId(), destaque: false, criadoEm: new Date() };
        lances.push({ ...lance, atleta: { id: atletaId, nome, fotoUrl: null } });
        return lance;
      },
      listarDoAtleta: async (atletaId, paginacao) =>
        paginar(
          [...lances]
            .reverse()
            .filter((l) => l.atleta.id === atletaId)
            .sort((a, b) => Number(!!b.destaque) - Number(!!a.destaque))
            .map((lance) => ({
              ...paraLance(lance),
              visualizacoes: visualizacoes.filter((v) => v.videoId === lance.id).length,
            })),
          paginacao,
        ),
      buscarParaDono: async (id) => {
        const lance = lances.find((l) => l.id === id);
        return lance
          ? { atletaId: lance.atleta.id, url: lance.url, destaque: !!lance.destaque }
          : null;
      },
      contarDestaques: async (atletaId) =>
        lances.filter((l) => l.atleta.id === atletaId && l.destaque).length,
      atualizar: async (id, dados) => {
        const lance = lances.find((l) => l.id === id)!;
        if (dados.legenda !== undefined) lance.legenda = dados.legenda;
        if (dados.destaque !== undefined) lance.destaque = dados.destaque;
        return paraLance(lance);
      },
      remover: async (id) => {
        lances.splice(
          lances.findIndex((l) => l.id === id),
          1,
        );
      },
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

    atletas: {
      buscar: async (consulta, paginacao) => {
        const lista = atletas
          .filter(
            (a) => !consulta.busca || a.nome.toLowerCase().includes(consulta.busca.toLowerCase()),
          )
          .filter((a) => !consulta.nascidoDe || a.dataNascimento >= consulta.nascidoDe)
          .filter((a) => !consulta.nascidoAte || a.dataNascimento <= consulta.nascidoAte)
          .filter((a) => !consulta.pePreferencial || a.pePreferencial === consulta.pePreferencial)
          .filter(
            (a) =>
              !consulta.posicoes?.length || a.posicoes.some((p) => consulta.posicoes!.includes(p)),
          )
          .sort((a, b) =>
            consulta.ordem === "maisAltos" ? b.alturaCm - a.alturaCm : a.nome.localeCompare(b.nome),
          );
        return paginar(lista, paginacao);
      },
    },

    convites: {
      listarDoAtleta: async (atletaId, paginacao) =>
        paginar(
          [...convites]
            .reverse()
            .filter((c) => c.atletaId === atletaId)
            .map(({ id, status, mensagem, criadoEm, avaliacaoId }) => {
              const inscricao = inscricoes.find((i) => i.conviteId === id);
              return {
                id,
                status,
                mensagem,
                criadoEm,
                avaliacao: avaliacoes.find((a) => a.id === avaliacaoId)!,
                inscricao: inscricao ? { id: inscricao.id, status: inscricao.status } : null,
              };
            }),
          paginacao,
        ),
      buscar: async (id) => {
        const convite = convites.find((c) => c.id === id);
        if (!convite) return null;
        const avaliacao = avaliacoes.find((a) => a.id === convite.avaliacaoId)!;
        const atleta = usuarios.find((u) => u.id === convite.atletaId)!;
        return {
          id,
          olheiroId: convite.olheiroId,
          status: convite.status,
          atleta: { id: atleta.id, nome: atleta.nome },
          avaliacao: {
            id: avaliacao.id,
            nome: avaliacao.nome,
            dataHora: avaliacao.dataHora,
            status: avaliacao.status,
          },
        };
      },
      recusar: async (id, agora) => {
        Object.assign(
          convites.find((c) => c.id === id)!,
          {
            status: "RECUSADO",
            respondidoEm: agora,
          },
        );
      },
      avaliacaoParaConvite: async (avaliacaoId) => {
        const avaliacao = avaliacoes.find((a) => a.id === avaliacaoId);
        if (!avaliacao) return null;
        const { nome, dataHora, status, olheiro } = avaliacao;
        return { olheiroId: olheiro.id, nome, dataHora, status };
      },
      jaConvidado: async (atletaId, avaliacaoId) =>
        convites.some(
          (c) =>
            c.atletaId === atletaId &&
            c.avaliacaoId === avaliacaoId &&
            ["PENDENTE", "ACEITO"].includes(c.status),
        ) ||
        inscricoes.some(
          (i) => i.atletaId === atletaId && i.avaliacaoId === avaliacaoId && ativa(i.status),
        ),
      criar: async (dados) => {
        const convite = {
          ...dados,
          id: novoId(),
          status: "PENDENTE" as const,
          criadoEm: new Date(),
          respondidoEm: null,
        };
        convites.push(convite);
        return { id: convite.id, status: convite.status, criadoEm: convite.criadoEm };
      },
    },

    notificacoes: {
      criar: async (lista) => {
        for (const { dados, ...nova } of lista) {
          notificacoes.push({
            ...nova,
            dados: dados ?? null,
            id: novoId(),
            lida: false,
            criadoEm: new Date(),
          });
        }
      },
      listar: async (usuarioId, paginacao) => {
        const doUsuario = [...notificacoes].reverse().filter((n) => n.usuarioId === usuarioId);
        return {
          ...paginar(
            doUsuario.map(({ usuarioId: _usuarioId, ...notificacao }) => notificacao),
            paginacao,
          ),
          naoLidas: doUsuario.filter((n) => !n.lida).length,
        };
      },
      marcarComoLidas: async (usuarioId, ids) => {
        for (const notificacao of notificacoes) {
          if (notificacao.usuarioId === usuarioId && (!ids || ids.includes(notificacao.id))) {
            notificacao.lida = true;
          }
        }
      },
    },

    olheiroVerificado: async (usuarioId) => olheirosVerificados.has(usuarioId),

    verificacoes: {
      situacao: async (olheiroId) => {
        const verificado = olheirosVerificados.has(olheiroId);
        return { verificado, status: verificado ? "APROVADA" : null, motivoRecusa: null };
      },
    },

    armazenamento: {
      salvar: async ({ pasta, extensao, conteudo }) => {
        const url = `/uploads/${pasta}/${novoId()}.${extensao}`;
        arquivos.set(url, conteudo);
        return url;
      },
      remover: async (url) => {
        arquivos.delete(url);
      },
    },
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
    atletas,
    arquivos,
    convites,
    notificacoes,
    responsaveis,
  };
}
