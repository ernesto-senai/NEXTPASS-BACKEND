import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  // Endereço do app nos links dos e-mails (nova senha, vínculo). No celular,
  // use o esquema do app: nextpass://
  APP_URL: z.string().default("http://localhost:8081"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((valor) =>
      valor
        .split(",")
        .map((origem) => origem.trim())
        .filter(Boolean),
    ),
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error("Variáveis de ambiente inválidas:", z.flattenError(resultado.error).fieldErrors);
  process.exit(1);
}

export const env = resultado.data;
