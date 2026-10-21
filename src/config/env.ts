import "dotenv/config";
import { z } from "zod";

// Variável vazia no .env (ex.: SMTP_HOST=) conta como não definida.
const opcional = z
  .string()
  .optional()
  .transform((valor) => valor?.trim() || undefined);

const envSchema = z
  .object({
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
    // E-mail de verdade (nova senha, vínculo). Sem SMTP_HOST, o e-mail aparece
    // no terminal da API.
    SMTP_HOST: opcional,
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: opcional,
    SMTP_PASS: opcional,
    MAIL_FROM: opcional,
  })
  .refine((env) => !env.SMTP_HOST || (env.SMTP_USER && env.SMTP_PASS), {
    path: ["SMTP_USER"],
    error: "Com SMTP_HOST, informe também SMTP_USER e SMTP_PASS.",
  });

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error("Variáveis de ambiente inválidas:", z.flattenError(resultado.error).fieldErrors);
  process.exit(1);
}

export const env = resultado.data;
