import type { RequestHandler } from "express";
import { env } from "../config/env.ts";
import { criarBuscarAtletas } from "../modules/atletas/application/buscar-atletas.ts";
import { criarConsultarAtleta } from "../modules/atletas/application/consultar-atleta.ts";
import type { AtletaRepository } from "../modules/atletas/domain/atleta.ts";
import type { AtletasCasosDeUso } from "../modules/atletas/http/atletas.routes.ts";
import { criarAtletaRepositoryPrisma } from "../modules/atletas/infra/prisma-atleta-repository.ts";
import { criarEmitirSessao } from "../modules/auth/application/emitir-sessao.ts";
import { criarEncerrarSessao } from "../modules/auth/application/encerrar-sessao.ts";
import { criarFazerLogin } from "../modules/auth/application/fazer-login.ts";
import {
  criarPedirNovaSenha,
  criarRedefinirSenha,
} from "../modules/auth/application/redefinir-senha.ts";
import { criarRenovarSessao } from "../modules/auth/application/renovar-sessao.ts";
import {
  type ContaRepository,
  DURACAO_SESSAO_MS,
  type EmissorTokens,
  type RefreshTokenRepository,
  type TokenSenhaRepository,
  type UsuarioAutenticado,
} from "../modules/auth/domain/sessao.ts";
import type { AuthCasosDeUso } from "../modules/auth/http/auth.routes.ts";
import { criarEmissorTokens } from "../modules/auth/infra/emissor-tokens.ts";
import {
  criarContaRepositoryPrisma,
  criarRefreshTokenRepositoryPrisma,
  criarTokenSenhaRepositoryPrisma,
} from "../modules/auth/infra/prisma-repositories.ts";
import { criarCadastrarAvaliacao } from "../modules/avaliacoes/application/cadastrar-avaliacao.ts";
import { criarConsultarAvaliacao } from "../modules/avaliacoes/application/consultar-avaliacao.ts";
import { criarListarAvaliacoes } from "../modules/avaliacoes/application/listar-avaliacoes.ts";
import {
  criarCancelarAvaliacao,
  criarEditarAvaliacao,
  criarListarMinhasAvaliacoes,
} from "../modules/avaliacoes/application/minhas-avaliacoes.ts";
import type { AvaliacaoRepository } from "../modules/avaliacoes/domain/avaliacao.ts";
import type { AvaliacoesCasosDeUso } from "../modules/avaliacoes/http/avaliacoes.routes.ts";
import { criarAvaliacaoRepositoryPrisma } from "../modules/avaliacoes/infra/prisma-avaliacao-repository.ts";
import {
  criarListarConvitesRecebidos,
  criarResponderConvite,
} from "../modules/convites/application/convites-recebidos.ts";
import { criarEnviarConvite } from "../modules/convites/application/enviar-convite.ts";
import type { ConviteRepository } from "../modules/convites/domain/convite.ts";
import type { ConvitesCasosDeUso } from "../modules/convites/http/convites.routes.ts";
import { criarConviteRepositoryPrisma } from "../modules/convites/infra/prisma-convite-repository.ts";
import {
  criarAnalisarDenuncia,
  criarDenunciar,
  criarListarDenuncias,
} from "../modules/denuncias/application/denuncias.ts";
import type { DenunciaRepository } from "../modules/denuncias/domain/denuncia.ts";
import type { DenunciasCasosDeUso } from "../modules/denuncias/http/denuncias.routes.ts";
import { criarDenunciaRepositoryPrisma } from "../modules/denuncias/infra/prisma-denuncia-repository.ts";
import { criarAlterarInscricao } from "../modules/inscricoes/application/alterar-inscricao.ts";
import { criarInscreverAtleta } from "../modules/inscricoes/application/inscrever-atleta.ts";
import {
  criarListarInscricoesParaAprovar,
  criarListarParticipantes,
} from "../modules/inscricoes/application/listar-inscritos.ts";
import { criarListarMinhasInscricoes } from "../modules/inscricoes/application/listar-minhas-inscricoes.ts";
import type { InscricaoRepository } from "../modules/inscricoes/domain/inscricao.ts";
import type { InscricoesCasosDeUso } from "../modules/inscricoes/http/inscricoes.routes.ts";
import { criarInscricaoRepositoryPrisma } from "../modules/inscricoes/infra/prisma-inscricao-repository.ts";
import {
  criarListarNotificacoes,
  criarMarcarComoLidas,
} from "../modules/notificacoes/application/notificacoes.ts";
import type { NotificacaoRepository } from "../modules/notificacoes/domain/notificacao.ts";
import type { NotificacoesCasosDeUso } from "../modules/notificacoes/http/notificacoes.routes.ts";
import { criarNotificacaoRepositoryPrisma } from "../modules/notificacoes/infra/prisma-notificacao-repository.ts";
import {
  criarCadastrarAtleta,
  criarCadastrarOlheiro,
} from "../modules/usuarios/application/cadastrar-usuario.ts";
import { criarExcluirConta, criarTrocarFoto } from "../modules/usuarios/application/conta.ts";
import {
  criarAtualizarPerfilAtleta,
  criarConsultarPerfil,
} from "../modules/usuarios/application/perfil.ts";
import type { PerfilRepository } from "../modules/usuarios/domain/perfil.ts";
import type { UsuarioRepository } from "../modules/usuarios/domain/usuario-repository.ts";
import type { UsuariosCasosDeUso } from "../modules/usuarios/http/usuarios.routes.ts";
import { criarPerfilRepositoryPrisma } from "../modules/usuarios/infra/prisma-perfil-repository.ts";
import { criarUsuarioRepositoryPrisma } from "../modules/usuarios/infra/prisma-usuario-repository.ts";
import { criarConsultarVerificacao } from "../modules/verificacoes/application/consultar-verificacao.ts";
import {
  criarAnalisarVerificacao,
  criarEnviarDocumentos,
  criarListarVerificacoes,
} from "../modules/verificacoes/application/enviar-documentos.ts";
import type { VerificacaoRepository } from "../modules/verificacoes/domain/verificacao.ts";
import type { VerificacoesCasosDeUso } from "../modules/verificacoes/http/verificacoes.routes.ts";
import { criarConsultaOlheiroVerificado } from "../modules/verificacoes/infra/prisma-olheiro-verificado.ts";
import { criarVerificacaoRepositoryPrisma } from "../modules/verificacoes/infra/prisma-verificacao-repository.ts";
import {
  criarListarFeedDeLances,
  criarRegistrarVisualizacao,
} from "../modules/videos/application/feed-de-lances.ts";
import {
  criarEditarLance,
  criarExcluirLance,
  criarListarMeusLances,
} from "../modules/videos/application/meus-lances.ts";
import { criarPublicarLance } from "../modules/videos/application/publicar-lance.ts";
import type { LanceRepository } from "../modules/videos/domain/lance.ts";
import type { VideosCasosDeUso } from "../modules/videos/http/videos.routes.ts";
import { lerDuracaoDoVideo } from "../modules/videos/infra/duracao-video.ts";
import { criarLanceRepositoryPrisma } from "../modules/videos/infra/prisma-lance-repository.ts";
import {
  criarAceitarVinculo,
  criarConsultarPedidoDeVinculo,
  criarListarAtletasDoResponsavel,
  criarListarVinculosDoAtleta,
  criarPedirVinculo,
} from "../modules/vinculos/application/vinculos.ts";
import type { VinculoRepository } from "../modules/vinculos/domain/vinculo.ts";
import type { VinculosCasosDeUso } from "../modules/vinculos/http/vinculos.routes.ts";
import { criarVinculoRepositoryPrisma } from "../modules/vinculos/infra/prisma-vinculo-repository.ts";
import type { Armazenamento } from "../shared/domain/armazenamento.ts";
import type { Correio } from "../shared/domain/correio.ts";
import type { Hasher } from "../shared/domain/hasher.ts";
import { exigirOlheiroVerificado } from "../shared/http/middlewares/authorize.ts";
import { prisma } from "../shared/infra/database/prisma.ts";
import { criarCorreioConsole } from "../shared/infra/mail/correio-console.ts";
import { criarBcryptHasher } from "../shared/infra/security/bcrypt-hasher.ts";
import { criarArmazenamentoLocal } from "../shared/infra/storage/armazenamento-local.ts";

export interface Dependencias {
  auth: AuthCasosDeUso;
  usuarios: UsuariosCasosDeUso;
  avaliacoes: AvaliacoesCasosDeUso;
  inscricoes: InscricoesCasosDeUso;
  convites: ConvitesCasosDeUso;
  notificacoes: NotificacoesCasosDeUso;
  videos: VideosCasosDeUso;
  atletas: AtletasCasosDeUso;
  verificacoes: VerificacoesCasosDeUso;
  vinculos: VinculosCasosDeUso;
  denuncias: DenunciasCasosDeUso;
  exigirOlheiroVerificado: RequestHandler;
}

export interface Adaptadores {
  contas: ContaRepository;
  refreshTokens: RefreshTokenRepository;
  tokensSenha: TokenSenhaRepository;
  usuarios: UsuarioRepository;
  perfis: PerfilRepository;
  avaliacoes: AvaliacaoRepository;
  inscricoes: InscricaoRepository;
  convites: ConviteRepository;
  notificacoes: NotificacaoRepository;
  lances: LanceRepository;
  atletas: AtletaRepository;
  verificacoes: VerificacaoRepository;
  vinculos: VinculoRepository;
  denuncias: DenunciaRepository;
  olheiroVerificado: (usuarioId: string) => Promise<boolean>;
  armazenamento: Armazenamento;
  correio: Correio;
  // Endereço do app nos links dos e-mails (nova senha, vínculo).
  urlDoApp: string;
  hasher: Hasher;
  tokens: EmissorTokens;
}

// Composição: liga os casos de uso aos adaptadores. Os testes passam
// adaptadores em memória; a API usa os de Prisma.
export function montarDependencias(adaptadores: Adaptadores): Dependencias {
  const emitirSessao = criarEmitirSessao(adaptadores);
  const inscreverAtleta = criarInscreverAtleta(adaptadores);
  const consultarPerfil = criarConsultarPerfil(adaptadores);
  // Cadastro e confirmação do vínculo já entram no app, com a sessão longa.
  const iniciarSessao = (usuario: UsuarioAutenticado) =>
    emitirSessao(usuario, new Date(Date.now() + DURACAO_SESSAO_MS.lembrar));

  return {
    auth: {
      fazerLogin: criarFazerLogin({ ...adaptadores, emitirSessao }),
      renovarSessao: criarRenovarSessao({ ...adaptadores, emitirSessao }),
      encerrarSessao: criarEncerrarSessao(adaptadores),
      pedirNovaSenha: criarPedirNovaSenha(adaptadores),
      redefinirSenha: criarRedefinirSenha(adaptadores),
    },
    usuarios: {
      cadastrarAtleta: criarCadastrarAtleta(adaptadores),
      cadastrarOlheiro: criarCadastrarOlheiro(adaptadores),
      iniciarSessao,
      consultarPerfil,
      atualizarPerfilAtleta: criarAtualizarPerfilAtleta({ ...adaptadores, consultarPerfil }),
      trocarFoto: criarTrocarFoto(adaptadores),
      excluirConta: criarExcluirConta(adaptadores),
    },
    avaliacoes: {
      listarAvaliacoes: criarListarAvaliacoes(adaptadores),
      cadastrarAvaliacao: criarCadastrarAvaliacao(adaptadores),
      listarMinhasAvaliacoes: criarListarMinhasAvaliacoes(adaptadores),
      cancelarAvaliacao: criarCancelarAvaliacao(adaptadores),
      consultarAvaliacao: criarConsultarAvaliacao(adaptadores),
      editarAvaliacao: criarEditarAvaliacao(adaptadores),
    },
    inscricoes: {
      inscreverAtleta,
      listarMinhasInscricoes: criarListarMinhasInscricoes(adaptadores),
      listarParticipantes: criarListarParticipantes(adaptadores),
      listarInscricoesParaAprovar: criarListarInscricoesParaAprovar(adaptadores),
      alterarInscricao: criarAlterarInscricao(adaptadores),
    },
    convites: {
      enviarConvite: criarEnviarConvite(adaptadores),
      listarConvitesRecebidos: criarListarConvitesRecebidos(adaptadores),
      responderConvite: criarResponderConvite({ ...adaptadores, inscreverAtleta }),
    },
    notificacoes: {
      listarNotificacoes: criarListarNotificacoes(adaptadores),
      marcarComoLidas: criarMarcarComoLidas(adaptadores),
    },
    videos: {
      listarFeedDeLances: criarListarFeedDeLances(adaptadores),
      publicarLance: criarPublicarLance({ ...adaptadores, lerDuracao: lerDuracaoDoVideo }),
      listarMeusLances: criarListarMeusLances(adaptadores),
      editarLance: criarEditarLance(adaptadores),
      excluirLance: criarExcluirLance(adaptadores),
      registrarVisualizacao: criarRegistrarVisualizacao(adaptadores),
    },
    atletas: {
      buscarAtletas: criarBuscarAtletas(adaptadores),
      consultarAtleta: criarConsultarAtleta(adaptadores),
    },
    verificacoes: {
      consultarVerificacao: criarConsultarVerificacao(adaptadores),
      enviarDocumentos: criarEnviarDocumentos(adaptadores),
      listarVerificacoes: criarListarVerificacoes(adaptadores),
      analisarVerificacao: criarAnalisarVerificacao(adaptadores),
    },
    vinculos: {
      pedirVinculo: criarPedirVinculo(adaptadores),
      listarVinculosDoAtleta: criarListarVinculosDoAtleta(adaptadores),
      listarAtletasDoResponsavel: criarListarAtletasDoResponsavel(adaptadores),
      consultarPedidoDeVinculo: criarConsultarPedidoDeVinculo(adaptadores),
      aceitarVinculo: criarAceitarVinculo(adaptadores),
      iniciarSessao,
    },
    denuncias: {
      denunciar: criarDenunciar(adaptadores),
      listarDenuncias: criarListarDenuncias(adaptadores),
      analisarDenuncia: criarAnalisarDenuncia(adaptadores),
    },
    exigirOlheiroVerificado: exigirOlheiroVerificado(adaptadores.olheiroVerificado),
  };
}

export function criarDependencias(): Dependencias {
  return montarDependencias({
    contas: criarContaRepositoryPrisma(prisma),
    refreshTokens: criarRefreshTokenRepositoryPrisma(prisma),
    tokensSenha: criarTokenSenhaRepositoryPrisma(prisma),
    usuarios: criarUsuarioRepositoryPrisma(prisma),
    perfis: criarPerfilRepositoryPrisma(prisma),
    avaliacoes: criarAvaliacaoRepositoryPrisma(prisma),
    inscricoes: criarInscricaoRepositoryPrisma(prisma),
    convites: criarConviteRepositoryPrisma(prisma),
    notificacoes: criarNotificacaoRepositoryPrisma(prisma),
    lances: criarLanceRepositoryPrisma(prisma),
    atletas: criarAtletaRepositoryPrisma(prisma),
    verificacoes: criarVerificacaoRepositoryPrisma(prisma),
    vinculos: criarVinculoRepositoryPrisma(prisma),
    denuncias: criarDenunciaRepositoryPrisma(prisma),
    olheiroVerificado: criarConsultaOlheiroVerificado(prisma),
    armazenamento: criarArmazenamentoLocal(),
    correio: criarCorreioConsole(),
    urlDoApp: env.APP_URL,
    hasher: criarBcryptHasher(),
    tokens: criarEmissorTokens({
      segredo: env.JWT_ACCESS_SECRET,
      expiraEm: env.JWT_ACCESS_EXPIRES_IN,
    }),
  });
}
