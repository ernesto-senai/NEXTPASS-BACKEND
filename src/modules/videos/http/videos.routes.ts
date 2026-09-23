import { Router } from "express";

// Lances (Endpoints v2.0, seção 5.4)
// GET    /videos                  Olheiro verificado  RF-32
// POST   /videos                  Atleta              RF-25, RF-29 (MP4/MOV até 50 MB, 30 a 60 s, RN-09)
// GET    /perfil/videos           Atleta              RF-28
// PATCH  /videos/:id              Atleta (dono)       RF-31
// DELETE /videos/:id              Atleta (dono)       RF-30
// POST   /videos/:id/visualizacoes  Olheiro verificado  RF-33

export const videosRoutes = Router();
