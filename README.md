# NextPass · API

API REST do NextPass (TCC): conecta atletas de base a olheiros verificados, com proteção reforçada para menores de idade.

**Stack:** Node.js 24 · TypeScript 6 · Express 5 · Prisma 7 · PostgreSQL 18 · Zod · Vitest

Requisitos, regras de negócio e rotas estão em `../DOCUMENTS` (Requisitos v2.0 e Endpoints v2.0). Os comentários do código citam os mesmos identificadores (RF, RN, RNF).

## Como rodar

```bash
cp .env.example .env          # ajuste os segredos
npm install                   # também gera o Prisma Client
docker compose up -d db       # sobe o PostgreSQL
npm run db:migrate            # aplica as migrações de prisma/migrations
npm run db:seed               # cria a conta de administrador
npm run dev                   # http://localhost:3333/health
```

**Com o PostgreSQL instalado na máquina (pgAdmin):** no lugar do `docker compose`, rode [prisma/setup-local.sql](prisma/setup-local.sql) no Query Tool do banco `postgres`, uma parte por vez. Ele cria o usuário e o banco `nextpass` que o `.env.example` já espera. Depois siga do `db:migrate` em diante.

**Sem Docker e sem PostgreSQL instalado:** `npx prisma dev --name nextpass --detach` sobe um PostgreSQL local e mostra a URL `postgres://...`. Coloque essa URL no `DATABASE_URL` do `.env` e siga do `db:migrate` em diante.

Stack completa em contêineres (banco, migrações e API): `docker compose --profile full up --build`.

### Rotas prontas

- **Login e cadastro:** `POST /auth/login`, `/auth/refresh` e `/auth/logout`, `POST /atletas`, `POST /olheiros` e `GET /termos`. O cadastro já devolve a sessão (`usuario`, `accessToken`, `refreshToken`).
- **Feed do atleta:** `GET /avaliacoes` (peneiras e testes futuros, sem o endereço completo) e `GET /perfil/inscricoes?situacao=ativas|participadas`.
- **Feed do olheiro verificado:** `GET /videos` e `POST /videos/:id/visualizacoes`.

Os outros módulos só listam as próprias rotas por enquanto.

### Dados de demonstração

`npm run db:demo` recria contas de teste (todas com a senha `demo12345`), peneiras com datas a partir de hoje, inscrições e lances. Ele só mexe em contas `@demo.nextpass.app`.

- `atleta@demo.nextpass.app`: atleta de 17 anos, com uma inscrição aguardando o responsável e uma já participada.
- `olheiro@demo.nextpass.app`: olheiro **já verificado**, que vê o feed de lances.

Os vídeos são exemplos de domínio público do MDN e não são de futebol; servem até o upload de lances existir.

## Scripts

| Script                          | O que faz                                      |
| ------------------------------- | ---------------------------------------------- |
| `dev`                           | API em modo watch (tsx)                        |
| `build` / `start`               | Compila para `dist/` e roda a versão compilada |
| `typecheck` / `lint` / `format` | Tipos, ESLint e Prettier                       |
| `test` / `test:watch`           | Testes com Vitest                              |
| `db:migrate` / `db:deploy`      | Cria migração em dev / aplica em produção      |
| `db:seed` / `db:studio`         | Seed do admin / Prisma Studio                  |
| `db:demo`                       | Recria os dados de demonstração                |

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

**Como implementar um módulo** (siga `auth` e `usuarios` como exemplo):

1. `domain/`: tipos e contratos (ex.: `ContaRepository`).
2. `application/`: um caso de uso por arquivo, criado por uma função `criarX(deps)` que recebe os contratos.
3. `infra/`: a implementação Prisma dos contratos.
4. `http/`: `criarXRoutes(casos)` com os schemas Zod.
5. `src/main/dependencias.ts`: liga tudo. Nos testes, `montarDependencias` recebe adaptadores em memoria (`tests/support`), então rotas e regras são testadas sem banco.

### Decisões de modelagem

- **Contador de vagas** (`Avaliacao.vagasOcupadas`): a última vaga é ocupada com um `UPDATE` condicional (`WHERE vagasOcupadas < vagas`), o que evita que duas inscrições simultâneas passem do limite (RN-06).
- **Uma inscrição por atleta e avaliação** (`@@unique([avaliacaoId, atletaId])`): o banco garante a RN-07. Uma reinscrição muda o status da linha que já existe.
- **Taxa em centavos** (`taxaCentavos: Int`) em vez de ponto flutuante (RN-13: a taxa é só informativa).
- **Tabela `Token`**: guarda só o hash dos tokens de atualização e de redefinição de senha, para o logout invalidar a sessão (RNF-07).
- **Tabelas e campos além da Figura 2:** `Token`, `Usuario.fotoUrl`, `Usuario.termosAceitosEm` (registro do aceite, RF-10), `Vinculo.tokenHash` (link do responsável) e `Avaliacao.local/cidade/uf`. A cidade e a UF ficam separadas do endereço porque aparecem no card, e o endereço completo só depois da confirmação (RN-08).

### Próximas dependências (entram com cada módulo)

`multer` (upload de lances e documentos), `google-auth-library` (RF-04), `nodemailer` ou um provedor de e-mail (RF-05, RF-48), `expo-server-sdk` (push, RF-53) e o SDK do armazenamento de mídia escolhido.
