import type {
  AlvoDenuncia,
  AtuacaoOlheiro,
  StatusConvite,
  StatusDenuncia,
  StatusInscricao,
  StatusUsuario,
  StatusVerificacao,
  StatusVinculo,
  TipoUsuario,
} from "../../src/generated/prisma/enums.ts";
import type { Adaptadores } from "../../src/main/dependencias.ts";
import type { AtletaPerfil } from "../../src/modules/atletas/domain/atleta.ts";
import { criarEmissorTokens } from "../../src/modules/auth/infra/emissor-tokens.ts";
import type { AvaliacaoResumo } from "../../src/modules/avaliacoes/domain/avaliacao.ts";
import type { NovoConvite } from "../../src/modules/convites/domain/convite.ts";
import { inscricaoAtiva } from "../../src/modules/inscricoes/domain/inscricao.ts";
import type { Notificacao } from "../../src/modules/notificacoes/domain/notificacao.ts";
import type { LanceDoFeed } from "../../src/modules/videos/domain/lance.ts";
import type { Email } from "../../src/shared/domain/correio.ts";
import { intervalo, type Paginacao } from "../../src/shared/domain/pagina.ts";

interface UsuarioMemoria {
  id: string;
  nome: string;
  email: string;
  senhaHash: string | null;
  tipo: TipoUsuario;
  status: StatusUsuario;
  fotoUrl?: string | null;
  olheiro?: { telefone: string; atuacao: AtuacaoOlheiro; clube: string | null };
}

interface TokenMemoria {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

// Os testes criam avaliações direto aqui; requisitos e endereço são opcionais.
type AvaliacaoMemoria = AvaliacaoResumo & { requisitos?: string; endereco?: string };

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

interface VinculoMemoria {
  id: string;
  atletaId: string;
  emailResponsavel: string;
  responsavelId: string | null;
  status: StatusVinculo;
  tokenHash: string | null;
  expiraEm: Date | null;
}

interface VerificacaoMemoria {
  id: string;
  olheiroId: string;
  status: StatusVerificacao;
  documentoUrl: string;
  comprovanteUrl: string | null;
  motivoRecusa: string | null;
  criadoEm: Date;
}

interface DenunciaMemoria {
  id: string;
  autorId: string;
  alvoTipo: AlvoDenuncia;
  alvoId: string;
  motivo: string;
  status: StatusDenuncia;
  decisao: string | null;
  criadoEm: Date;
}

// O card da avaliação não traz requisitos e endereço.
const resumoDe = ({
  requisitos: _requisitos,
  endereco: _endereco,
  ...resumo
}: AvaliacaoMemoria): AvaliacaoResumo => resumo;

const paginar = <T>(lista: T[], paginacao: Paginacao) => {
  const { skip, take } = intervalo(paginacao);
  return { dados: lista.slice(skip, skip + take), total: lista.length };
};

const contem = (texto: string, busca: string) => texto.toLowerCase().includes(busca.toLowerCase());

// Adaptadores sem banco para testar casos de uso e rotas. O hasher é trivial
// para os testes rodarem rápido; o emissor de tokens é o real.
export function criarAdaptadoresEmMemoria() {
  const usuarios: UsuarioMemoria[] = [];
  const tokens: TokenMemoria[] = [];
  const tokensSenha: TokenMemoria[] = [];
  const avaliacoes: AvaliacaoMemoria[] = [];
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
  // Atalho dos testes: responsáveis já confirmados, por atleta (RN-03).
  const responsaveis = new Map<string, string[]>();
  const vinculos: VinculoMemoria[] = [];
  const verificacoes: VerificacaoMemoria[] = [];
  const denuncias: DenunciaMemoria[] = [];
  const emails: Email[] = [];
  let sequencia = 0;
  // Ids no formato UUID, como os do banco, para passar na validação das rotas.
  const novoId = () => `00000000-0000-7000-8000-${String(++sequencia).padStart(12, "0")}`;

  const usuario = (id: string) => usuarios.find((u) => u.id === id);

  const responsaveisDe = (atletaId: string) => [
    ...(responsaveis.get(atletaId) ?? []),
    ...vinculos
      .filter((v) => v.atletaId === atletaId && v.status === "CONFIRMADO")
      .map((v) => v.responsavelId!),
  ];

  // Lance como o dono vê: sem os dados do autor.
  const paraLance = ({ atleta: _atleta, destaque, ...lance }: (typeof lances)[number]) => ({
    ...lance,
    destaque: !!destaque,
  });

  // A avaliação lotada fecha e os convites pendentes expiram (RN-06, RN-12).
  const fecharSeLotou = (avaliacao: AvaliacaoMemoria) => {
    if (avaliacao.vagasOcupadas < avaliacao.vagas) return;
    avaliacao.status = "ESGOTADA";
    for (const convite of convites) {
      if (convite.avaliacaoId === avaliacao.id && convite.status === "PENDENTE") {
        convite.status = "EXPIRADO";
      }
    }
  };

  const vagaLivre = (avaliacao: AvaliacaoMemoria | undefined, agora: Date) =>
    !!avaliacao &&
    avaliacao.status === "ABERTA" &&
    avaliacao.dataHora > agora &&
    avaliacao.vagasOcupadas < avaliacao.vagas;

  const criar = (dados: Omit<UsuarioMemoria, "id" | "status">) => {
    if (usuarios.some((u) => u.email === dados.email)) return Promise.resolve(null);
    const novo = { ...dados, id: novoId(), status: "ATIVO" as const };
    usuarios.push(novo);
    return Promise.resolve({ id: novo.id, nome: novo.nome, tipo: novo.tipo });
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
    correio: {
      enviar: async (email) => {
        emails.push(email);
      },
    },
    urlDoApp: "nextpass:/",

    contas: {
      buscarPorEmail: async (email) => usuarios.find((u) => u.email === email) ?? null,
      buscarPorId: async (id) => usuario(id) ?? null,
      atualizarSenha: async (id, senhaHash) => {
        usuario(id)!.senhaHash = senhaHash;
      },
    },

    perfis: {
      buscar: async (usuarioId) => {
        const conta = usuario(usuarioId);
        if (!conta) return null;
        const perfil = atletas.find((a) => a.id === usuarioId);
        const pedidos = vinculos.filter((v) => v.atletaId === usuarioId);
        return {
          id: conta.id,
          nome: conta.nome,
          email: conta.email,
          fotoUrl: conta.fotoUrl ?? null,
          tipo: conta.tipo,
          atleta:
            conta.tipo === "ATLETA"
              ? {
                  dataNascimento: perfil?.dataNascimento ?? null,
                  posicoes: perfil?.posicoes ?? [],
                  alturaCm: perfil?.alturaCm ?? null,
                  pesoKg: perfil?.pesoKg ?? null,
                  pePreferencial: perfil?.pePreferencial ?? null,
                  cidade: perfil?.cidade ?? null,
                  uf: perfil?.uf ?? null,
                  nacionalidade: perfil?.nacionalidade ?? null,
                  responsavel:
                    responsaveisDe(usuarioId).length > 0
                      ? "CONFIRMADO"
                      : pedidos.length > 0
                        ? "PENDENTE"
                        : null,
                }
              : null,
          olheiro: conta.olheiro
            ? { ...conta.olheiro, verificado: olheirosVerificados.has(usuarioId) }
            : null,
        };
      },
      atualizarAtleta: async (usuarioId, { nome, ...dados }) => {
        usuario(usuarioId)!.nome = nome;
        const perfil = { id: usuarioId, nome, fotoUrl: null, ...dados };
        const indice = atletas.findIndex((a) => a.id === usuarioId);
        if (indice >= 0) atletas[indice] = perfil;
        else atletas.push(perfil);
      },
      atualizarFoto: async (usuarioId, fotoUrl) => {
        const conta = usuario(usuarioId)!;
        const anterior = conta.fotoUrl ?? null;
        conta.fotoUrl = fotoUrl;
        return anterior;
      },
      excluirConta: async (usuarioId) => {
        const conta = usuario(usuarioId)!;
        const urls = [
          conta.fotoUrl,
          ...lances.filter((l) => l.atleta.id === usuarioId).map((l) => l.url),
          ...verificacoes
            .filter((v) => v.olheiroId === usuarioId)
            .flatMap((v) => [v.documentoUrl, v.comprovanteUrl]),
        ].filter((url): url is string => !!url);

        const remover = <T>(lista: T[], doUsuario: (item: T) => boolean) => {
          for (let i = lista.length - 1; i >= 0; i--) if (doUsuario(lista[i]!)) lista.splice(i, 1);
        };
        remover(usuarios, (u) => u.id === usuarioId);
        remover(atletas, (a) => a.id === usuarioId);
        remover(lances, (l) => l.atleta.id === usuarioId);
        remover(inscricoes, (i) => i.atletaId === usuarioId);
        remover(convites, (c) => c.atletaId === usuarioId || c.olheiroId === usuarioId);
        remover(avaliacoes, (a) => a.olheiro.id === usuarioId);
        remover(vinculos, (v) => v.atletaId === usuarioId || v.responsavelId === usuarioId);
        remover(verificacoes, (v) => v.olheiroId === usuarioId);
        remover(notificacoes, (n) => n.usuarioId === usuarioId);
        olheirosVerificados.delete(usuarioId);
        return urls;
      },
    },

    usuarios: {
      emailEmUso: async (email) => usuarios.some((u) => u.email === email),
      criarAtleta: ({ nome, email, senhaHash }) =>
        criar({ nome, email, senhaHash, tipo: "ATLETA" }),
      criarOlheiro: ({ nome, email, senhaHash, telefone, atuacao, clube }) =>
        criar({ nome, email, senhaHash, tipo: "OLHEIRO", olheiro: { telefone, atuacao, clube } }),
      criarResponsavel: ({ nome, email, senhaHash }) =>
        criar({ nome, email, senhaHash, tipo: "RESPONSAVEL" }),
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
      revogarTodos: async (usuarioId, agora) => {
        for (const token of tokens) {
          if (token.usuarioId === usuarioId && !token.usadoEm) token.usadoEm = agora;
        }
      },
    },

    tokensSenha: {
      salvar: async (dados) => {
        for (const token of tokensSenha) {
          if (token.usuarioId === dados.usuarioId && !token.usadoEm) token.usadoEm = new Date();
        }
        tokensSenha.push({ ...dados, id: novoId(), usadoEm: null });
      },
      buscarValido: async (tokenHash, agora) =>
        tokensSenha.find((t) => t.tokenHash === tokenHash && !t.usadoEm && t.expiraEm > agora) ??
        null,
      usar: async (id, agora) => {
        const token = tokensSenha.find((t) => t.id === id && !t.usadoEm);
        if (token) token.usadoEm = agora;
        return !!token;
      },
    },

    avaliacoes: {
      criar: async (olheiroId, dados) => {
        const avaliacao: AvaliacaoMemoria = {
          ...dados,
          id: novoId(),
          vagasOcupadas: 0,
          status: "ABERTA",
          clube: null,
          olheiro: { id: olheiroId, nome: usuario(olheiroId)!.nome },
        };
        avaliacoes.push(avaliacao);
        return resumoDe(avaliacao);
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
      buscarDetalhe: async (id) => {
        const avaliacao = avaliacoes.find((a) => a.id === id);
        if (!avaliacao) return null;
        return {
          ...avaliacao,
          requisitos: avaliacao.requisitos ?? "Chuteira e documento com foto",
          endereco: avaliacao.endereco ?? "Rua de teste, 100",
        };
      },
      buscarParaDono: async (id) => {
        const avaliacao = avaliacoes.find((a) => a.id === id);
        if (!avaliacao) return null;
        const { nome, status, dataHora, olheiro, vagasOcupadas } = avaliacao;
        return { olheiroId: olheiro.id, nome, status, dataHora, vagasOcupadas };
      },
      atualizar: async (id, dados) => {
        const avaliacao = avaliacoes.find((a) => a.id === id)!;
        Object.assign(avaliacao, dados, {
          status: avaliacao.vagasOcupadas >= dados.vagas ? "ESGOTADA" : "ABERTA",
        });
        return {
          avaliacao: resumoDe(avaliacao),
          inscritos: inscricoes
            .filter((i) => i.avaliacaoId === id && inscricaoAtiva(i.status))
            .map((i) => i.atletaId),
        };
      },
      cancelar: async (id) => {
        avaliacoes.find((a) => a.id === id)!.status = "CANCELADA";
        const ativas = inscricoes.filter((i) => i.avaliacaoId === id && inscricaoAtiva(i.status));
        for (const inscricao of ativas) inscricao.status = "CANCELADA";
        for (const convite of convites) {
          if (convite.avaliacaoId === id && convite.status === "PENDENTE") {
            convite.status = "EXPIRADO";
          }
        }
        return ativas.map((inscricao) => inscricao.atletaId);
      },
      listarFuturas: async (filtro, paginacao, agora) => {
        const casa = (texto: string | null) => !!texto && contem(texto, filtro.busca!);
        const lista = avaliacoes
          .filter((a) => a.dataHora > agora)
          .filter((a) =>
            (filtro.somenteComVagas ? ["ABERTA"] : ["ABERTA", "ESGOTADA"]).includes(a.status),
          )
          .filter((a) => !filtro.busca || casa(a.nome) || casa(a.clube))
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
        const conta = usuarios.find((u) => u.id === atletaId && u.tipo === "ATLETA");
        if (!conta) return null;
        const perfil = atletas.find((a) => a.id === atletaId);
        return {
          nome: conta.nome,
          perfilCompleto: !!perfil,
          dataNascimento: perfil?.dataNascimento ?? null,
          responsaveis: responsaveisDe(atletaId),
        };
      },
      inscrever: async ({ atletaId, avaliacaoId, conviteId, status }, agora) => {
        const existente = inscricoes.find(
          (i) => i.atletaId === atletaId && i.avaliacaoId === avaliacaoId,
        );
        if (existente && inscricaoAtiva(existente.status)) return "INSCRICAO_EXISTENTE";
        const avaliacao = avaliacoes.find((a) => a.id === avaliacaoId);
        if (!avaliacao || avaliacao.status !== "ABERTA" || avaliacao.dataHora <= agora) {
          return "SEM_VAGAS";
        }
        if (status === "CONFIRMADA") {
          if (!vagaLivre(avaliacao, agora)) return "SEM_VAGAS";
          avaliacao.vagasOcupadas++;
        }

        const inscricao = existente ?? { id: novoId(), atletaId, avaliacaoId, status };
        Object.assign(inscricao, { status, conviteId });
        if (!existente) inscricoes.push(inscricao);
        const convite = convites.find((c) => c.id === conviteId);
        if (convite) Object.assign(convite, { status: "ACEITO", respondidoEm: agora });
        fecharSeLotou(avaliacao);

        return {
          id: inscricao.id,
          status,
          avaliacao: { nome: avaliacao.nome, olheiroId: avaliacao.olheiro.id },
        };
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
              ? inscricaoAtiva(status) && avaliacao.dataHora > agora
              : status === "CONFIRMADA" && avaliacao.dataHora <= agora,
          );
        return paginar(lista, paginacao);
      },
      daAvaliacao: async (atletaId, avaliacaoId) => {
        const inscricao = inscricoes.find(
          (i) => i.atletaId === atletaId && i.avaliacaoId === avaliacaoId,
        );
        return inscricao ? { id: inscricao.id, status: inscricao.status } : null;
      },
      buscarParaAlteracao: async (id) => {
        const inscricao = inscricoes.find((i) => i.id === id);
        if (!inscricao) return null;
        const avaliacao = avaliacoes.find((a) => a.id === inscricao.avaliacaoId)!;
        return {
          id,
          status: inscricao.status,
          atleta: { id: inscricao.atletaId, nome: usuario(inscricao.atletaId)!.nome },
          avaliacao: {
            id: avaliacao.id,
            nome: avaliacao.nome,
            olheiroId: avaliacao.olheiro.id,
            dataHora: avaliacao.dataHora,
            status: avaliacao.status,
          },
        };
      },
      encerrar: async (id, status) => {
        const inscricao = inscricoes.find((i) => i.id === id)!;
        const ocupavaVaga = inscricao.status === "CONFIRMADA";
        inscricao.status = status;
        if (ocupavaVaga) {
          const avaliacao = avaliacoes.find((a) => a.id === inscricao.avaliacaoId)!;
          avaliacao.vagasOcupadas--;
          if (avaliacao.status === "ESGOTADA") avaliacao.status = "ABERTA";
        }
      },
      confirmar: async (id, agora) => {
        const inscricao = inscricoes.find((i) => i.id === id)!;
        const avaliacao = avaliacoes.find((a) => a.id === inscricao.avaliacaoId)!;
        if (!vagaLivre(avaliacao, agora)) return "SEM_VAGAS";
        avaliacao.vagasOcupadas++;
        inscricao.status = "CONFIRMADA";
        fecharSeLotou(avaliacao);
        return "CONFIRMADA";
      },
      listarInscritos: async (avaliacaoId, busca, paginacao) => {
        const lista = inscricoes
          .filter((i) => i.avaliacaoId === avaliacaoId && inscricaoAtiva(i.status))
          .map((i) => {
            const conta = usuario(i.atletaId)!;
            const perfil = atletas.find((a) => a.id === i.atletaId);
            return {
              id: i.id,
              status: i.status,
              criadoEm: new Date(),
              atleta: {
                id: conta.id,
                nome: conta.nome,
                fotoUrl: conta.fotoUrl ?? null,
                dataNascimento: perfil?.dataNascimento ?? null,
                posicoes: perfil?.posicoes ?? [],
                cidade: perfil?.cidade ?? null,
                uf: perfil?.uf ?? null,
              },
            };
          })
          .filter((i) => !busca || contem(i.atleta.nome, busca))
          .sort((a, b) => a.atleta.nome.localeCompare(b.atleta.nome));
        return paginar(lista, paginacao);
      },
      responsavelDe: async (responsavelId, atletaId) =>
        responsaveisDe(atletaId).includes(responsavelId),
      listarParaResponsavel: async (responsavelId, paginacao, agora) => {
        const lista = inscricoes
          .filter((i) => i.status === "AGUARDANDO_RESPONSAVEL")
          .filter((i) => responsaveisDe(i.atletaId).includes(responsavelId))
          .map((i) => ({
            id: i.id,
            status: i.status,
            atleta: { id: i.atletaId, nome: usuario(i.atletaId)!.nome },
            avaliacao: avaliacoes.find((a) => a.id === i.avaliacaoId)!,
          }))
          .filter(({ avaliacao }) => avaliacao.dataHora > agora);
        return paginar(lista, paginacao);
      },
    },

    lances: {
      criar: async ({ atletaId, ...dados }) => {
        const lance = { ...dados, id: novoId(), destaque: false, criadoEm: new Date() };
        lances.push({
          ...lance,
          atleta: { id: atletaId, nome: usuario(atletaId)!.nome, fotoUrl: null },
        });
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
          .filter((a) => !consulta.busca || contem(a.nome, consulta.busca))
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
      buscarPorId: async (id) => atletas.find((a) => a.id === id) ?? null,
    },

    convites: {
      listarRecebidos: async (destino, paginacao) =>
        paginar(
          [...convites]
            .reverse()
            .filter((c) =>
              "atletaId" in destino
                ? c.atletaId === destino.atletaId
                : responsaveisDe(c.atletaId).includes(destino.responsavelId),
            )
            .map(({ id, status, mensagem, criadoEm, avaliacaoId, atletaId }) => {
              const inscricao = inscricoes.find((i) => i.conviteId === id);
              return {
                id,
                status,
                mensagem,
                criadoEm,
                avaliacao: avaliacoes.find((a) => a.id === avaliacaoId)!,
                inscricao: inscricao ? { id: inscricao.id, status: inscricao.status } : null,
                atleta: { id: atletaId, nome: usuario(atletaId)!.nome },
              };
            }),
          paginacao,
        ),
      buscar: async (id) => {
        const convite = convites.find((c) => c.id === id);
        if (!convite) return null;
        const avaliacao = avaliacoes.find((a) => a.id === convite.avaliacaoId)!;
        return {
          id,
          olheiroId: convite.olheiroId,
          status: convite.status,
          atleta: { id: convite.atletaId, nome: usuario(convite.atletaId)!.nome },
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
          (i) =>
            i.atletaId === atletaId && i.avaliacaoId === avaliacaoId && inscricaoAtiva(i.status),
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
        const ultima = verificacoes.filter((v) => v.olheiroId === olheiroId).at(-1);
        return {
          verificado,
          status: ultima?.status ?? (verificado ? "APROVADA" : null),
          motivoRecusa: ultima?.motivoRecusa ?? null,
        };
      },
      atuacaoDoOlheiro: async (olheiroId) => usuario(olheiroId)?.olheiro?.atuacao ?? null,
      criar: async (dados) => {
        verificacoes.push({
          ...dados,
          id: novoId(),
          status: "PENDENTE",
          motivoRecusa: null,
          criadoEm: new Date(),
        });
      },
      listarParaAnalise: async (status, paginacao) =>
        paginar(
          verificacoes
            .filter((v) => v.status === status)
            .map(({ id, criadoEm, documentoUrl, comprovanteUrl, olheiroId }) => {
              const conta = usuario(olheiroId)!;
              return {
                id,
                status,
                criadoEm,
                documentoUrl,
                comprovanteUrl,
                olheiro: {
                  id: olheiroId,
                  nome: conta.nome,
                  email: conta.email,
                  atuacao: conta.olheiro!.atuacao,
                  clube: conta.olheiro!.clube,
                },
              };
            }),
          paginacao,
        ),
      buscar: async (id) => {
        const verificacao = verificacoes.find((v) => v.id === id);
        return verificacao
          ? { id, olheiroId: verificacao.olheiroId, status: verificacao.status }
          : null;
      },
      analisar: async (id, { status, motivoRecusa }) => {
        const verificacao = verificacoes.find((v) => v.id === id)!;
        Object.assign(verificacao, { status, motivoRecusa });
        if (status === "APROVADA") olheirosVerificados.add(verificacao.olheiroId);
        else olheirosVerificados.delete(verificacao.olheiroId);
      },
    },

    vinculos: {
      salvarPedido: async ({ atletaId, emailResponsavel, tokenHash, expiraEm }) => {
        const existente = vinculos.find(
          (v) => v.atletaId === atletaId && v.emailResponsavel === emailResponsavel,
        );
        if (existente?.status === "CONFIRMADO") return existente;
        if (existente) {
          Object.assign(existente, { tokenHash, expiraEm });
          return existente;
        }
        const novo: VinculoMemoria = {
          id: novoId(),
          atletaId,
          emailResponsavel,
          responsavelId: null,
          status: "PENDENTE",
          tokenHash,
          expiraEm,
        };
        vinculos.push(novo);
        return novo;
      },
      listarDoAtleta: async (atletaId) =>
        vinculos
          .filter((v) => v.atletaId === atletaId)
          .map(({ id, emailResponsavel, status, responsavelId }) => ({
            id,
            emailResponsavel,
            status,
            responsavel: responsavelId ? { nome: usuario(responsavelId)!.nome } : null,
          })),
      listarDoResponsavel: async (responsavelId) =>
        vinculos
          .filter((v) => v.responsavelId === responsavelId && v.status === "CONFIRMADO")
          .map((v) => ({
            vinculoId: v.id,
            atleta: {
              id: v.atletaId,
              nome: usuario(v.atletaId)!.nome,
              fotoUrl: null,
              dataNascimento: atletas.find((a) => a.id === v.atletaId)?.dataNascimento ?? null,
            },
          })),
      buscarPorToken: async (tokenHash) => {
        const vinculo = vinculos.find((v) => v.tokenHash === tokenHash);
        if (!vinculo) return null;
        return {
          id: vinculo.id,
          atleta: { id: vinculo.atletaId, nome: usuario(vinculo.atletaId)!.nome },
          emailResponsavel: vinculo.emailResponsavel,
          status: vinculo.status,
          expiraEm: vinculo.expiraEm,
        };
      },
      confirmar: async (id, responsavelId) => {
        Object.assign(
          vinculos.find((v) => v.id === id)!,
          {
            responsavelId,
            status: "CONFIRMADO",
            tokenHash: null,
            expiraEm: null,
          },
        );
      },
    },

    denuncias: {
      donoDoAlvo: async (alvoTipo, alvoId) => {
        if (alvoTipo === "PERFIL") return usuario(alvoId)?.id ?? null;
        if (alvoTipo === "VIDEO") return lances.find((l) => l.id === alvoId)?.atleta.id ?? null;
        if (alvoTipo === "CONVITE") return convites.find((c) => c.id === alvoId)?.olheiroId ?? null;
        return avaliacoes.find((a) => a.id === alvoId)?.olheiro.id ?? null;
      },
      criar: async (dados) => {
        const denuncia: DenunciaMemoria = {
          ...dados,
          id: novoId(),
          status: "ABERTA",
          decisao: null,
          criadoEm: new Date(),
        };
        denuncias.push(denuncia);
        return { id: denuncia.id, status: denuncia.status };
      },
      listar: async (status, paginacao) =>
        paginar(
          denuncias
            .filter((d) => d.status === status)
            .map(({ autorId, decisao: _decisao, ...denuncia }) => ({
              ...denuncia,
              autor: { id: autorId, nome: usuario(autorId)?.nome ?? "" },
            })),
          paginacao,
        ),
      buscar: async (id) => {
        const denuncia = denuncias.find((d) => d.id === id);
        if (!denuncia) return null;
        const { status, alvoTipo, alvoId } = denuncia;
        return { id, status, alvoTipo, alvoId };
      },
      analisar: async (id, { status, decisao }) => {
        Object.assign(
          denuncias.find((d) => d.id === id)!,
          { status, decisao },
        );
      },
      suspender: async (usuarioId) => {
        usuario(usuarioId)!.status = "SUSPENSO";
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
    tokensSenha,
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
    vinculos,
    verificacoes,
    denuncias,
    emails,
  };
}
