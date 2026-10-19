import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { ListarNotificacoes, MarcarComoLidas } from "../application/notificacoes.ts";

// Notificações (Endpoints v2.0, seção 5.9)
// GET    /notificacoes            Autenticado      RF-47, RF-52
// PATCH  /notificacoes            Autenticado      RF-52

export interface NotificacoesCasosDeUso {
  listarNotificacoes: ListarNotificacoes;
  marcarComoLidas: MarcarComoLidas;
}

// { "ids": [...] } marca essas; corpo vazio marca todas.
const marcarSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100).optional() });

export function criarNotificacoesRoutes(casos: NotificacoesCasosDeUso) {
  const rotas = Router();

  rotas.get("/notificacoes", authenticate, async (req, res) => {
    res.json(
      await casos.listarNotificacoes(usuarioDaRequisicao(req).id, paginacaoSchema.parse(req.query)),
    );
  });

  rotas.patch("/notificacoes", authenticate, async (req, res) => {
    const { ids } = marcarSchema.parse(req.body ?? {});
    await casos.marcarComoLidas(usuarioDaRequisicao(req).id, ids);
    res.status(204).end();
  });

  return rotas;
}
