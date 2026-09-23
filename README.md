# NextPass · API

API REST do NextPass (TCC): conecta atletas de base a olheiros verificados, com proteção reforçada para menores de idade.

**Stack:** Node.js 24 · TypeScript 6 · Express 5 · Prisma 7 · PostgreSQL 18 · Zod · Vitest

Requisitos, regras de negócio e rotas estão em `../DOCUMENTS` (Requisitos v2.0 e Endpoints v2.0). Os comentários do código citam os mesmos identificadores (RF, RN, RNF).

## Como rodar

```bash
cp .env.example .env          # ajuste os segredos
npm install                   # também gera o Prisma Client
docker compose up -d db       # sobe o PostgreSQL
npm run db:migrate -- --name init
npm run db:seed               # cria a conta de administrador
npm run dev                   # http://localhost:3333/health
```

Stack completa em contêineres (banco, migrações e API): `docker compose --profile full up --build`.

## Scripts

| Script                          | O que faz                                      |
| ------------------------------- | ---------------------------------------------- |
| `dev`                           | API em modo watch (tsx)                        |
| `build` / `start`               | Compila para `dist/` e roda a versão compilada |
| `typecheck` / `lint` / `format` | Tipos, ESLint e Prettier                       |
| `test` / `test:watch`           | Testes com Vitest                              |
| `db:migrate` / `db:deploy`      | Cria migração em dev / aplica em produção      |
| `db:seed` / `db:studio`         | Seed do admin / Prisma Studio                  |

## Arquitetura

Monólito modular com camadas de Clean Architecture dentro de cada módulo. Cada módulo corresponde a um grupo de rotas do documento de endpoints.

```
src/
├── main/            Composição: cria o app Express, registra rotas e sobe o servidor
├── config/          Variáveis de ambiente validadas com Zod (a API não sobe se faltar algo)
├── modules/<modulo>/
│   ├── domain/      Entidades, regras puras e contratos de repositório (sem Express/Prisma)
│   ├── application/ Casos de uso: orquestram as regras de negócio (RN-xx)
│   ├── infra/       Implementações dos contratos (repositórios Prisma)
│   └── http/        Rotas, controllers e schemas Zod de entrada
├── shared/
│   ├── domain/      Regras usadas por vários módulos (idade e categoria, RN-01)
│   ├── errors/      AppError e o catálogo de códigos de erro da API
│   ├── http/        Middlewares (autenticação, perfis, erros) e paginação
│   └── infra/       Prisma e adaptadores externos: storage, e-mail, push, segurança
├── generated/       Prisma Client gerado (não versionado)
└── @types/          Extensões de tipos (req.usuario)
```

**Regra de dependência:** `http → application → domain`, e `infra` implementa contratos de `domain`. O domínio não importa Express nem Prisma, por isso as regras de negócio são testadas sem banco.

**Fluxo de uma requisição:** `routes → middlewares (authenticate, authorize, requireOlheiroVerificado) → controller (valida com Zod) → caso de uso → repositório → Prisma`. Os erros viram `{ "erro": { "codigo", "mensagem" } }` no `errorHandler`.

### Decisões de modelagem

- **Contador de vagas** (`Avaliacao.vagasOcupadas`): a última vaga é ocupada com um `UPDATE` condicional (`WHERE vagasOcupadas < vagas`), o que evita que duas inscrições simultâneas passem do limite (RN-06).
- **Uma inscrição por atleta e avaliação** (`@@unique([avaliacaoId, atletaId])`): o banco garante a RN-07. Uma reinscrição muda o status da linha que já existe.
- **Taxa em centavos** (`taxaCentavos: Int`) em vez de ponto flutuante (RN-13: a taxa é só informativa).
- **Tabela `Token`**: guarda só o hash dos tokens de atualização e de redefinição de senha, para o logout invalidar a sessão (RNF-07).
- **Tabelas e campos além da Figura 2:** `Token`, `Usuario.fotoUrl`, `Usuario.termosAceitosEm` (registro do aceite, RF-10), `Vinculo.tokenHash` (link do responsável) e `Avaliacao.local/cidade/uf`. A cidade e a UF ficam separadas do endereço porque aparecem no card, e o endereço completo só depois da confirmação (RN-08).

### Próximas dependências (entram com cada módulo)

`multer` (upload de lances e documentos), `express-rate-limit` (RNF-08), `google-auth-library` (RF-04), `nodemailer` ou um provedor de e-mail (RF-05, RF-48), `expo-server-sdk` (push, RF-53) e o SDK do armazenamento de mídia escolhido.
