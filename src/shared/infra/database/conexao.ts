// Com sslmode=require (Supabase), criptografa sem conferir o certificado, como o psql:
// o pg trataria o require como verify-full, e o Node não conhece a autoridade do Supabase.
export function conexaoPostgres(url: string) {
  const endereco = new URL(url);
  if (endereco.searchParams.get("sslmode") !== "require") return { connectionString: url };

  endereco.searchParams.delete("sslmode");
  return { connectionString: endereco.toString(), ssl: { rejectUnauthorized: false } };
}
