import "dotenv/config";
import { z } from "zod";

// Variável vazia no .env conta como não preenchida.
const vazioComoAusente = (valor: unknown) => (valor === "" ? undefined : valor);
const opcional = <T extends z.ZodType>(tipo: T) => z.preprocess(vazioComoAusente, tipo.optional());
const texto = (padrao: string) => z.preprocess(vazioComoAusente, z.string().default(padrao));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    // Endereço do app no link de vínculo com o responsável. Publicado, é o app web.
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
    // Onde ficam lances, fotos e documentos: "local" (pasta uploads) ou "s3" (Supabase
    // Storage, Cloudflare R2 ou AWS S3), para todos os aparelhos verem os mesmos arquivos.
    STORAGE_DRIVER: z.preprocess(vazioComoAusente, z.enum(["local", "s3"]).default("local")),
    S3_ENDPOINT: opcional(z.url()),
    S3_REGION: texto("us-east-1"),
    S3_ACCESS_KEY_ID: opcional(z.string()),
    S3_SECRET_ACCESS_KEY: opcional(z.string()),
    S3_PUBLIC_BUCKET: texto("nextpass-publico"),
    S3_PRIVATE_BUCKET: texto("nextpass-privado"),
    // Endereço público do bucket de lances e fotos.
    S3_PUBLIC_URL: opcional(z.url()),
    // E-mails (código de nova senha e link do responsável): "console" mostra no terminal
    // da API; "brevo" envia de verdade, pela API do Brevo.
    EMAIL_DRIVER: z.preprocess(vazioComoAusente, z.enum(["console", "brevo"]).default("console")),
    BREVO_API_KEY: opcional(z.string()),
    // Remetente confirmado no Brevo.
    EMAIL_FROM: opcional(z.email()),
    EMAIL_FROM_NAME: texto("NextPass"),
  })
  .superRefine((dados, ctx) => {
    const exigir = (nomes: readonly (keyof typeof dados)[], motivo: string) => {
      for (const nome of nomes) {
        if (!dados[nome]) {
          ctx.addIssue({ code: "custom", path: [nome], message: `Obrigatória com ${motivo}.` });
        }
      }
    };
    if (dados.STORAGE_DRIVER === "s3") {
      exigir(
        ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"],
        "STORAGE_DRIVER=s3",
      );
    }
    if (dados.EMAIL_DRIVER === "brevo") {
      exigir(["BREVO_API_KEY", "EMAIL_FROM"], "EMAIL_DRIVER=brevo");
    }
  });

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error("Variáveis de ambiente inválidas:", z.flattenError(resultado.error).fieldErrors);
  process.exit(1);
}

export const env = resultado.data;
