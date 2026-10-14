-- Prepara o PostgreSQL local para o NextPass. Rode no pgAdmin, conectado ao
-- banco "postgres" (Query Tool), UMA PARTE POR VEZ: selecione o trecho e F5.
-- As tabelas NÃO são criadas aqui: quem cria é o Prisma (npm run db:migrate).

-- PARTE 1: usuário nextpass (senha nextpass), igual ao .env.example.
-- Funciona na primeira vez e também se o usuário já existir com outra senha.
-- CREATEDB é necessário: o "prisma migrate dev" cria um banco temporário.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'nextpass') THEN
    ALTER ROLE nextpass WITH LOGIN PASSWORD 'nextpass' CREATEDB;
  ELSE
    CREATE ROLE nextpass WITH LOGIN PASSWORD 'nextpass' CREATEDB;
  END IF;
END
$$;

-- PARTE 2: banco nextpass. Se aparecer "já existe", pode seguir para a parte 3.
CREATE DATABASE nextpass OWNER nextpass ENCODING 'UTF8';

-- PARTE 3: garante que o dono do banco é o nextpass (necessário se o banco
-- foi criado antes pelo pgAdmin com o dono postgres).
ALTER DATABASE nextpass OWNER TO nextpass;
