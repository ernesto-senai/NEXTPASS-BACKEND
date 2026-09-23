import { Router } from "express";

// Vínculo com o responsável (Endpoints v2.0, seção 5.3)
// POST   /vinculos                Atleta           RF-15
// POST   /responsaveis            Público (token)  RF-48
// GET    /vinculos                Autenticado      RF-49

export const vinculosRoutes = Router();
