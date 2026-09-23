import { Router } from "express";

// Avaliações (Endpoints v2.0, seção 5.6)
// GET    /avaliacoes              Atleta                     RF-18, RF-19, RF-23, RF-24
// GET    /avaliacoes/:id          Autenticado                RF-20 (endereço só após confirmação, RN-08)
// POST   /avaliacoes              Olheiro verificado         RF-41
// PATCH  /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// DELETE /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// GET    /perfil/avaliacoes       Olheiro                    RF-39, RF-42

export const avaliacoesRoutes = Router();
