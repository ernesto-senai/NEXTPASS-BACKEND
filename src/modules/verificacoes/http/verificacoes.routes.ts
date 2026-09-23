import { Router } from "express";

// Verificação do olheiro (Endpoints v2.0, seções 5.3 e 5.10)
// POST   /perfil/verificacao      Olheiro          RF-16 (multipart, armazenamento privado, RNF-09)
// GET    /perfil/verificacao      Olheiro          RF-17
// GET    /admin/verificacoes      Administrador    RF-57
// PATCH  /admin/verificacoes/:id  Administrador    RF-57

export const verificacoesRoutes = Router();
