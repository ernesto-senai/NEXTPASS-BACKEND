import { describe, expect, it } from "vitest";
import { conexaoPostgres } from "../../../../src/shared/infra/database/conexao.ts";

describe("conexão com o PostgreSQL", () => {
  it("usa a URL como está no banco local", () => {
    const url = "postgresql://nextpass:nextpass@localhost:5432/nextpass?schema=public";

    expect(conexaoPostgres(url)).toEqual({ connectionString: url });
  });

  it("com sslmode=require (Supabase), criptografa sem conferir o certificado", () => {
    const conexao = conexaoPostgres(
      "postgresql://postgres.abc:senha@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
    );

    expect(conexao).toEqual({
      connectionString:
        "postgresql://postgres.abc:senha@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      ssl: { rejectUnauthorized: false },
    });
  });
});
