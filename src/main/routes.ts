import { Router } from "express";
import { atletasRoutes } from "../modules/atletas/http/atletas.routes.ts";
import { criarAuthRoutes } from "../modules/auth/http/auth.routes.ts";
import { criarAvaliacoesRoutes } from "../modules/avaliacoes/http/avaliacoes.routes.ts";
import { convitesRoutes } from "../modules/convites/http/convites.routes.ts";
import { denunciasRoutes } from "../modules/denuncias/http/denuncias.routes.ts";
import { criarInscricoesRoutes } from "../modules/inscricoes/http/inscricoes.routes.ts";
import { notificacoesRoutes } from "../modules/notificacoes/http/notificacoes.routes.ts";
import { criarUsuariosRoutes } from "../modules/usuarios/http/usuarios.routes.ts";
import { verificacoesRoutes } from "../modules/verificacoes/http/verificacoes.routes.ts";
import { criarVideosRoutes } from "../modules/videos/http/videos.routes.ts";
import { vinculosRoutes } from "../modules/vinculos/http/vinculos.routes.ts";
import type { Dependencias } from "./dependencias.ts";

// Cada módulo declara os caminhos completos das próprias rotas. Os módulos já
// implementados recebem os casos de uso prontos (criarXRoutes).
export function criarRotas(deps: Dependencias) {
  const routes = Router();

  routes.use(criarAuthRoutes(deps.auth));
  routes.use(criarUsuariosRoutes(deps.usuarios));
  routes.use(verificacoesRoutes);
  routes.use(vinculosRoutes);
  routes.use(criarVideosRoutes(deps.videos, deps.exigirOlheiroVerificado));
  routes.use(atletasRoutes);
  routes.use(criarAvaliacoesRoutes(deps.avaliacoes));
  routes.use(criarInscricoesRoutes(deps.inscricoes));
  routes.use(convitesRoutes);
  routes.use(notificacoesRoutes);
  routes.use(denunciasRoutes);

  return routes;
}
