import { type RequestHandler, Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { AlterarInscricao } from "../application/alterar-inscricao.ts";
import type { InscreverAtleta } from "../application/inscrever-atleta.ts";
import type {
  ListarInscricoesParaAprovar,
  ListarParticipantes,
} from "../application/listar-inscritos.ts";
import type { ListarMinhasInscricoes } from "../application/listar-minhas-inscricoes.ts";

// Inscrições (Endpoints v2.0, seção 5.7)
// POST   /avaliacoes/:id/inscricoes  Atleta                     RF-21 (RN-03, RN-06, RN-07)
// GET    /avaliacoes/:id/inscricoes  Olheiro verificado (dono)  RF-44
// GET    /perfil/inscricoes          Atleta ou Responsável      RF-19, RF-50
// PATCH  /inscricoes/:id             Atleta, Responsável ou Olheiro (dono)  RF-22, RF-46, RF-50

export interface InscricoesCasosDeUso {
  inscreverAtleta: InscreverAtleta;
  listarMinhasInscricoes: ListarMinhasInscricoes;
  listarParticipantes: ListarParticipantes;
  listarInscricoesParaAprovar: ListarInscricoesParaAprovar;
  alterarInscricao: AlterarInscricao;
}

const idSchema = z.object({ id: z.uuid("Não encontrado.") });

const minhasInscricoesSchema = paginacaoSchema.extend({
  situacao: z.enum(["ativas", "participadas"]).default("ativas"),
});

const participantesSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(80).optional(),
});

// O atleta cancela, o olheiro remove e o responsável aprova ou recusa.
const alteracaoSchema = z.object({
  status: z.enum(["CANCELADA", "REMOVIDA", "CONFIRMADA", "RECUSADA"]),
});

export function criarInscricoesRoutes(
  casos: InscricoesCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  rotas.post("/avaliacoes/:id/inscricoes", authenticate, authorize("ATLETA"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    const { id: inscricaoId, status } = await casos.inscreverAtleta({
      atletaId: usuarioDaRequisicao(req).id,
      avaliacaoId: id,
    });
    res.status(201).json({ id: inscricaoId, status });
  });

  rotas.get(
    "/avaliacoes/:id/inscricoes",
    authenticate,
    exigirOlheiroVerificado,
    async (req, res) => {
      const { id } = idSchema.parse(req.params);
      const { busca, ...paginacao } = participantesSchema.parse(req.query);
      res.json(await casos.listarParticipantes(usuarioDaRequisicao(req).id, id, busca, paginacao));
    },
  );

  rotas.get(
    "/perfil/inscricoes",
    authenticate,
    authorize("ATLETA", "RESPONSAVEL"),
    async (req, res) => {
      const usuario = usuarioDaRequisicao(req);
      const { situacao, ...paginacao } = minhasInscricoesSchema.parse(req.query);
      res.json(
        usuario.tipo === "RESPONSAVEL"
          ? await casos.listarInscricoesParaAprovar(usuario.id, paginacao)
          : await casos.listarMinhasInscricoes(usuario.id, situacao, paginacao),
      );
    },
  );

  rotas.patch("/inscricoes/:id", authenticate, async (req, res) => {
    const { id } = idSchema.parse(req.params);
    const { status } = alteracaoSchema.parse(req.body);
    res.json(await casos.alterarInscricao(usuarioDaRequisicao(req), id, status));
  });

  return rotas;
}
