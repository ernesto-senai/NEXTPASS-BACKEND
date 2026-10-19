import { Router } from "express";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import type { ConsultarVerificacao } from "../application/consultar-verificacao.ts";

// Verificação do olheiro (Endpoints v2.0, seções 5.3 e 5.10)
// POST   /perfil/verificacao      Olheiro          RF-16 (multipart, armazenamento privado, RNF-09)
// GET    /perfil/verificacao      Olheiro          RF-17
// GET    /admin/verificacoes      Administrador    RF-57
// PATCH  /admin/verificacoes/:id  Administrador    RF-57

export interface VerificacoesCasosDeUso {
  consultarVerificacao: ConsultarVerificacao;
}

export function criarVerificacoesRoutes(casos: VerificacoesCasosDeUso) {
  const rotas = Router();

  rotas.get("/perfil/verificacao", authenticate, authorize("OLHEIRO"), async (req, res) => {
    res.json(await casos.consultarVerificacao(usuarioDaRequisicao(req).id));
  });

  return rotas;
}
