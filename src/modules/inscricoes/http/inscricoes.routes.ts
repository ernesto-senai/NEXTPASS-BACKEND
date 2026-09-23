import { Router } from "express";

// Inscrições (Endpoints v2.0, seção 5.7)
// POST   /avaliacoes/:id/inscricoes  Atleta                     RF-21 (RN-03, RN-06, RN-07)
// GET    /avaliacoes/:id/inscricoes  Olheiro verificado (dono)  RF-44
// GET    /perfil/inscricoes          Atleta                     RF-19
// PATCH  /inscricoes/:id             Atleta, Responsável ou Olheiro (dono)  RF-22, RF-46, RF-50

export const inscricoesRoutes = Router();
