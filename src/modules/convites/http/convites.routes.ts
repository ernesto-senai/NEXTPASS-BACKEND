import { Router } from "express";

// Convites (Endpoints v2.0, seção 5.8)
// POST   /convites                Olheiro verificado  RF-34, RF-39, RF-40 (até 300 caracteres, RN-10)
// GET    /convites                Autenticado         RF-26, RF-49
// PATCH  /convites/:id            Atleta              RF-27 (o aceite cria a inscrição)

export const convitesRoutes = Router();
