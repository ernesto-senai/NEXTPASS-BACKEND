import { Router } from "express";

// Autenticação (Endpoints v2.0, seção 5.1)
// POST   /auth/login              Público          RF-01, RF-03 (bloqueio após 5 tentativas, RNF-08)
// POST   /auth/google             Público          RF-04, RF-12
// POST   /auth/refresh            Público (token)  RF-03
// POST   /auth/logout             Autenticado      RF-55
// POST   /auth/esqueci-senha      Público          RF-05
// POST   /auth/redefinir-senha    Público (token)  RF-05

export const authRoutes = Router();
