import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { ListarMinhasInscricoes } from "../application/listar-minhas-inscricoes.ts";

// Inscrições (Endpoints v2.0, seção 5.7)
// POST   /avaliacoes/:id/inscricoes  Atleta                     RF-21 (RN-03, RN-06, RN-07)
// GET    /avaliacoes/:id/inscricoes  Olheiro verificado (dono)  RF-44
// GET    /perfil/inscricoes          Atleta                     RF-19
// PATCH  /inscricoes/:id             Atleta, Responsável ou Olheiro (dono)  RF-22, RF-46, RF-50

export interface InscricoesCasosDeUso {
  listarMinhasInscricoes: ListarMinhasInscricoes;
}

const minhasInscricoesSchema = paginacaoSchema.extend({
  situacao: z.enum(["ativas", "participadas"]).default("ativas"),
});

export function criarInscricoesRoutes(casos: InscricoesCasosDeUso) {
  const rotas = Router();

  rotas.get("/perfil/inscricoes", authenticate, authorize("ATLETA"), async (req, res) => {
    const { situacao, ...paginacao } = minhasInscricoesSchema.parse(req.query);
    res.json(await casos.listarMinhasInscricoes(usuarioDaRequisicao(req).id, situacao, paginacao));
  });

  return rotas;
}
