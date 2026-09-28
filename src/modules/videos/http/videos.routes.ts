import { type RequestHandler, Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { ListarFeedDeLances, RegistrarVisualizacao } from "../application/feed-de-lances.ts";

// Lances (Endpoints v2.0, seção 5.4)
// GET    /videos                  Olheiro verificado  RF-32
// POST   /videos                  Atleta              RF-25, RF-29 (MP4/MOV até 50 MB, 30 a 60 s, RN-09)
// GET    /perfil/videos           Atleta              RF-28
// PATCH  /videos/:id              Atleta (dono)       RF-31
// DELETE /videos/:id              Atleta (dono)       RF-30
// POST   /videos/:id/visualizacoes  Olheiro verificado  RF-33

export interface VideosCasosDeUso {
  listarFeedDeLances: ListarFeedDeLances;
  registrarVisualizacao: RegistrarVisualizacao;
}

const idSchema = z.object({ id: z.uuid("Lance não encontrado.") });

export function criarVideosRoutes(
  casos: VideosCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  rotas.get("/videos", authenticate, exigirOlheiroVerificado, async (req, res) => {
    res.json(await casos.listarFeedDeLances(paginacaoSchema.parse(req.query)));
  });

  rotas.post(
    "/videos/:id/visualizacoes",
    authenticate,
    exigirOlheiroVerificado,
    async (req, res) => {
      const { id } = idSchema.parse(req.params);
      await casos.registrarVisualizacao(id, usuarioDaRequisicao(req).id);
      res.status(204).end();
    },
  );

  return rotas;
}
