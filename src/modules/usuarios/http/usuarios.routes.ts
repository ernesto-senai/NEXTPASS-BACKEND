import { Router } from "express";

// Cadastro e perfil (Endpoints v2.0, seção 5.2)
// POST   /atletas                 Público          RF-08, RF-10, RF-12
// POST   /olheiros                Público          RF-09, RF-10, RF-12
// GET    /termos                  Público          RF-10
// GET    /perfil                  Autenticado      RF-14, RF-28
// PATCH  /perfil                  Autenticado      RF-13, RF-14 (recalcula idade e categoria, RN-01)
// DELETE /perfil                  Autenticado      RF-56 (exclusão prevista na LGPD)
// POST   /dispositivos            Autenticado      RF-53

export const usuariosRoutes = Router();
