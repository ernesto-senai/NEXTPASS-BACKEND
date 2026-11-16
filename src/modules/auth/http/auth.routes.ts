import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { emailSchema, senhaSchema } from "../../../shared/http/validacao.ts";
import type { EncerrarSessao } from "../application/encerrar-sessao.ts";
import type { FazerLogin } from "../application/fazer-login.ts";
import type { PedirNovaSenha, RedefinirSenha } from "../application/nova-senha.ts";
import type { RenovarSessao } from "../application/renovar-sessao.ts";

// Autenticação
// POST   /auth/login              Público          RF-01, RF-03 (bloqueio após 5 tentativas, RNF-08)
// POST   /auth/refresh            Público (token)  RF-03
// POST   /auth/logout             Autenticado      RF-55
// POST   /auth/esqueci-senha      Público          RF-05 (código de 6 números por e-mail)
// POST   /auth/redefinir-senha    Público          RF-05

export interface AuthCasosDeUso {
  fazerLogin: FazerLogin;
  renovarSessao: RenovarSessao;
  encerrarSessao: EncerrarSessao;
  pedirNovaSenha: PedirNovaSenha;
  redefinirSenha: RedefinirSenha;
}

const loginSchema = z.object({
  email: emailSchema,
  senha: z.string("Informe a senha.").min(1, "Informe a senha."),
  lembrar: z.boolean().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string("Informe o token de atualização.").min(1),
});

const pedidoDeSenhaSchema = z.object({ email: emailSchema });

const novaSenhaSchema = z.object({
  email: emailSchema,
  codigo: z
    .string("Informe o código.")
    .trim()
    .regex(/^\d{6}$/, "O código tem 6 números."),
  novaSenha: senhaSchema,
});

export function criarAuthRoutes(casos: AuthCasosDeUso) {
  const rotas = Router();

  // A chave junta IP e e-mail para não bloquear uma turma inteira no mesmo Wi-Fi.
  const limitePorEmail = (limite: number, contarSoErros: boolean) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: limite,
      skipSuccessfulRequests: contarSoErros,
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

  // RNF-08: 5 tentativas erradas de login bloqueiam novas tentativas por 15 minutos.
  const limiteLogin = limitePorEmail(5, true);
  // RF-05: até 3 códigos por e-mail a cada 15 minutos, para ninguém lotar a caixa de outra
  // pessoa, e 5 tentativas erradas de código, como no login.
  const limitePedidoDeSenha = limitePorEmail(3, false);
  const limiteCodigo = limitePorEmail(5, true);

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

  rotas.post("/auth/esqueci-senha", limitePedidoDeSenha, async (req, res) => {
    await casos.pedirNovaSenha(pedidoDeSenhaSchema.parse(req.body).email);
    res.status(204).end();
  });

  rotas.post("/auth/redefinir-senha", limiteCodigo, async (req, res) => {
    await casos.redefinirSenha(novaSenhaSchema.parse(req.body));
    res.status(204).end();
  });

  return rotas;
}
