import type { RequestHandler } from "express";
import { env } from "../config/env.ts";
import { criarEmitirSessao } from "../modules/auth/application/emitir-sessao.ts";
import { criarEncerrarSessao } from "../modules/auth/application/encerrar-sessao.ts";
import { criarFazerLogin } from "../modules/auth/application/fazer-login.ts";
import { criarRenovarSessao } from "../modules/auth/application/renovar-sessao.ts";
import {
  type ContaRepository,
  DURACAO_SESSAO_MS,
  type EmissorTokens,
  type RefreshTokenRepository,
} from "../modules/auth/domain/sessao.ts";
import type { AuthCasosDeUso } from "../modules/auth/http/auth.routes.ts";
import { criarEmissorTokens } from "../modules/auth/infra/emissor-tokens.ts";
import {
  criarContaRepositoryPrisma,
  criarRefreshTokenRepositoryPrisma,
} from "../modules/auth/infra/prisma-repositories.ts";
import { criarListarAvaliacoes } from "../modules/avaliacoes/application/listar-avaliacoes.ts";
import type { AvaliacaoRepository } from "../modules/avaliacoes/domain/avaliacao.ts";
import type { AvaliacoesCasosDeUso } from "../modules/avaliacoes/http/avaliacoes.routes.ts";
import { criarAvaliacaoRepositoryPrisma } from "../modules/avaliacoes/infra/prisma-avaliacao-repository.ts";
import { criarListarMinhasInscricoes } from "../modules/inscricoes/application/listar-minhas-inscricoes.ts";
import type { InscricaoRepository } from "../modules/inscricoes/domain/inscricao.ts";
import type { InscricoesCasosDeUso } from "../modules/inscricoes/http/inscricoes.routes.ts";
import { criarInscricaoRepositoryPrisma } from "../modules/inscricoes/infra/prisma-inscricao-repository.ts";
import {
  criarCadastrarAtleta,
  criarCadastrarOlheiro,
} from "../modules/usuarios/application/cadastrar-usuario.ts";
import type { UsuarioRepository } from "../modules/usuarios/domain/usuario-repository.ts";
import type { UsuariosCasosDeUso } from "../modules/usuarios/http/usuarios.routes.ts";
import { criarUsuarioRepositoryPrisma } from "../modules/usuarios/infra/prisma-usuario-repository.ts";
import { criarConsultaOlheiroVerificado } from "../modules/verificacoes/infra/prisma-olheiro-verificado.ts";
import {
  criarListarFeedDeLances,
  criarRegistrarVisualizacao,
} from "../modules/videos/application/feed-de-lances.ts";
import type { LanceRepository } from "../modules/videos/domain/lance.ts";
import type { VideosCasosDeUso } from "../modules/videos/http/videos.routes.ts";
import { criarLanceRepositoryPrisma } from "../modules/videos/infra/prisma-lance-repository.ts";
import type { Hasher } from "../shared/domain/hasher.ts";
import { exigirOlheiroVerificado } from "../shared/http/middlewares/authorize.ts";
import { prisma } from "../shared/infra/database/prisma.ts";
import { criarBcryptHasher } from "../shared/infra/security/bcrypt-hasher.ts";

export interface Dependencias {
  auth: AuthCasosDeUso;
  usuarios: UsuariosCasosDeUso;
  avaliacoes: AvaliacoesCasosDeUso;
  inscricoes: InscricoesCasosDeUso;
  videos: VideosCasosDeUso;
  exigirOlheiroVerificado: RequestHandler;
}

export interface Adaptadores {
  contas: ContaRepository;
  refreshTokens: RefreshTokenRepository;
  usuarios: UsuarioRepository;
  avaliacoes: AvaliacaoRepository;
  inscricoes: InscricaoRepository;
  lances: LanceRepository;
  olheiroVerificado: (usuarioId: string) => Promise<boolean>;
  hasher: Hasher;
  tokens: EmissorTokens;
}

// Composição: liga os casos de uso aos adaptadores. Os testes passam
// adaptadores em memória; a API usa os de Prisma.
export function montarDependencias(adaptadores: Adaptadores): Dependencias {
  const emitirSessao = criarEmitirSessao(adaptadores);

  return {
    auth: {
      fazerLogin: criarFazerLogin({ ...adaptadores, emitirSessao }),
      renovarSessao: criarRenovarSessao({ ...adaptadores, emitirSessao }),
      encerrarSessao: criarEncerrarSessao(adaptadores),
    },
    usuarios: {
      cadastrarAtleta: criarCadastrarAtleta(adaptadores),
      cadastrarOlheiro: criarCadastrarOlheiro(adaptadores),
      iniciarSessao: (usuario) =>
        emitirSessao(usuario, new Date(Date.now() + DURACAO_SESSAO_MS.lembrar)),
    },
    avaliacoes: {
      listarAvaliacoes: criarListarAvaliacoes(adaptadores),
    },
    inscricoes: {
      listarMinhasInscricoes: criarListarMinhasInscricoes(adaptadores),
    },
    videos: {
      listarFeedDeLances: criarListarFeedDeLances(adaptadores),
      registrarVisualizacao: criarRegistrarVisualizacao(adaptadores),
    },
    exigirOlheiroVerificado: exigirOlheiroVerificado(adaptadores.olheiroVerificado),
  };
}

export function criarDependencias(): Dependencias {
  return montarDependencias({
    contas: criarContaRepositoryPrisma(prisma),
    refreshTokens: criarRefreshTokenRepositoryPrisma(prisma),
    usuarios: criarUsuarioRepositoryPrisma(prisma),
    avaliacoes: criarAvaliacaoRepositoryPrisma(prisma),
    inscricoes: criarInscricaoRepositoryPrisma(prisma),
    lances: criarLanceRepositoryPrisma(prisma),
    olheiroVerificado: criarConsultaOlheiroVerificado(prisma),
    hasher: criarBcryptHasher(),
    tokens: criarEmissorTokens({
      segredo: env.JWT_ACCESS_SECRET,
      expiraEm: env.JWT_ACCESS_EXPIRES_IN,
    }),
  });
}
