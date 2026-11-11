import { env } from "../../../config/env.ts";
import type { Armazenamento } from "../../domain/armazenamento.ts";
import { criarArmazenamentoLocal } from "./armazenamento-local.ts";
import { criarArmazenamentoS3 } from "./armazenamento-s3.ts";

// Armazenamento escolhido no .env (STORAGE_DRIVER). As variáveis do S3 já foram
// conferidas em config/env.ts.
export function criarArmazenamentoDoAmbiente(): Armazenamento {
  if (env.STORAGE_DRIVER === "local") return criarArmazenamentoLocal();

  return criarArmazenamentoS3({
    endpoint: env.S3_ENDPOINT!,
    regiao: env.S3_REGION,
    chaveId: env.S3_ACCESS_KEY_ID!,
    chaveSecreta: env.S3_SECRET_ACCESS_KEY!,
    bucketPublico: env.S3_PUBLIC_BUCKET,
    bucketPrivado: env.S3_PRIVATE_BUCKET,
    urlPublica: env.S3_PUBLIC_URL!,
  });
}
