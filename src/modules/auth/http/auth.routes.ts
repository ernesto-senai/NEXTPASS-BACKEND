import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { emailSchema } from "../../../shared/http/validacao.ts";
import type { EncerrarSessao } from "../application/encerrar-sessao.ts";
import type { FazerLogin } from "../application/fazer-login.ts";
import type { RenovarSessao } from "../application/renovar-sessao.ts";

// Autenticação (Endpoints v2.0, seção 5.1)
// POST   /auth/login              Público          RF-01, RF-03 (bloqueio após 5 tentativas, RNF-08)
// POST   /auth/google             Público          RF-04, RF-12
// POST   /auth/refresh            Público (token)  RF-03
// POST   /auth/logout             Autenticado      RF-55
// POST   /auth/esqueci-senha      Público          RF-05
// POST   /auth/redefinir-senha    Público (token)  RF-05

export interface AuthCasosDeUso {
  fazerLogin: FazerLogin;
  renovarSessao: RenovarSessao;
  encerrarSessao: EncerrarSessao;
}

const loginSchema = z.object({
  email: emailSchema,
  senha: z.string("Informe a senha.").min(1, "Informe a senha."),
  lembrar: z.boolean().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string("Informe o token de atualização.").min(1),
});

export function criarAuthRoutes(casos: AuthCasosDeUso) {
  const rotas = Router();

  // RNF-08: 5 tentativas erradas bloqueiam novas tentativas por 15 minutos. A
  // chave junta IP e e-mail para não bloquear uma turma inteira no mesmo Wi-Fi.
  const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "")}:${String(req.body?.email ?? "")
        .trim()
        .toLowerCase()}`,
    handler: (_req, _res, next) => {
      next(new AppError("MUITAS_TENTATIVAS", "Muitas tentativas. Tente de novo em 15 minutos."));
    },
  });

  rotas.post("/auth/login", limiteLogin, async (req, res) => {
    res.json(await casos.fazerLogin(loginSchema.parse(req.body)));
  });

  rotas.post("/auth/refresh", async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await casos.renovarSessao(refreshToken));
  });

  rotas.post("/auth/logout", authenticate, async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await casos.encerrarSessao(refreshToken, usuarioDaRequisicao(req).id);
    res.status(204).end();
  });

  return rotas;
}
