import { Router } from "express";
import { atletasRoutes } from "../modules/atletas/http/atletas.routes.ts";
import { authRoutes } from "../modules/auth/http/auth.routes.ts";
import { avaliacoesRoutes } from "../modules/avaliacoes/http/avaliacoes.routes.ts";
import { convitesRoutes } from "../modules/convites/http/convites.routes.ts";
import { denunciasRoutes } from "../modules/denuncias/http/denuncias.routes.ts";
import { inscricoesRoutes } from "../modules/inscricoes/http/inscricoes.routes.ts";
import { notificacoesRoutes } from "../modules/notificacoes/http/notificacoes.routes.ts";
import { usuariosRoutes } from "../modules/usuarios/http/usuarios.routes.ts";
import { verificacoesRoutes } from "../modules/verificacoes/http/verificacoes.routes.ts";
import { videosRoutes } from "../modules/videos/http/videos.routes.ts";
import { vinculosRoutes } from "../modules/vinculos/http/vinculos.routes.ts";

// Cada módulo declara os caminhos completos das próprias rotas.
export const routes = Router();

routes.use(authRoutes);
routes.use(usuariosRoutes);
routes.use(verificacoesRoutes);
routes.use(vinculosRoutes);
routes.use(videosRoutes);
routes.use(atletasRoutes);
routes.use(avaliacoesRoutes);
routes.use(inscricoesRoutes);
routes.use(convitesRoutes);
routes.use(notificacoesRoutes);
routes.use(denunciasRoutes);
