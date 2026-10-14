import { Router } from "express";
import { authenticate } from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { ListarAvaliacoes } from "../application/listar-avaliacoes.ts";

// Avaliações (Endpoints v2.0, seção 5.6)
// GET    /avaliacoes              Atleta                     RF-18, RF-19, RF-23, RF-24
// GET    /avaliacoes/:id          Autenticado                RF-20 (endereço só após confirmação, RN-08)
// POST   /avaliacoes              Olheiro verificado         RF-41
// PATCH  /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// DELETE /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// GET    /perfil/avaliacoes       Olheiro                    RF-39, RF-42

export interface AvaliacoesCasosDeUso {
  listarAvaliacoes: ListarAvaliacoes;
}

export function criarAvaliacoesRoutes(casos: AvaliacoesCasosDeUso) {
  const rotas = Router();

  // Busca e filtros (RF-23, RF-24) entram com a tela de Pesquisa.
  rotas.get("/avaliacoes", authenticate, authorize("ATLETA"), async (req, res) => {
    res.json(await casos.listarAvaliacoes(paginacaoSchema.parse(req.query)));
  });

  return rotas;
}
