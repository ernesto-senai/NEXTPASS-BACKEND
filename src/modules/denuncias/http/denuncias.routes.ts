import { Router } from "express";

// Denúncias e moderação (Endpoints v2.0, seção 5.10)
// POST   /denuncias               Autenticado      RF-54 (ECA Digital, art. 28)
// GET    /admin/denuncias         Administrador    RF-58
// PATCH  /admin/denuncias/:id     Administrador    RF-58

export const denunciasRoutes = Router();
