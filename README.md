# NextPass · API

API REST do NextPass (TCC): conecta atletas de base a olheiros verificados, com proteção reforçada para menores de idade.

**Stack:** Node.js 24 · TypeScript 6 · Express 5 · Prisma 7 · PostgreSQL 18 · Zod · Vitest

Requisitos, regras de negócio e rotas estão em `../DOCUMENTS` (Requisitos v2.0 e Endpoints v2.0). Os comentários do código citam os mesmos identificadores (RF, RN, RNF).

## Como rodar

```bash
cp .env.example .env          # ajuste os segredos
npm install                   # também gera o Prisma Client
docker compose up -d db       # sobe o PostgreSQL
npm run db:deploy             # aplica as migrações de prisma/migrations
npm run db:seed               # cria a conta de administrador
npm run db:demo               # contas e dados de demonstração
npm run dev                   # http://localhost:3333/health
```

**Com o PostgreSQL instalado na máquina (pgAdmin):** no lugar do `docker compose`, rode [prisma/setup-local.sql](prisma/setup-local.sql) no Query Tool do banco `postgres`, uma parte por vez. Ele cria o usuário e o banco `nextpass` que o `.env.example` já espera. Depois siga do `db:deploy` em diante.

**Sem Docker e sem PostgreSQL instalado:** `npx prisma dev --name nextpass --detach` sobe um PostgreSQL local e mostra a URL `postgres://...`. Coloque essa URL no `DATABASE_URL` do `.env` e siga do `db:deploy` em diante.

A migração `busca_sem_acento` ativa as extensões `unaccent` e `pg_trgm`, que vêm com o PostgreSQL (instalador oficial e imagem Docker). Se ela falhar com "extension is not available", o PostgreSQL foi instalado sem os módulos "contrib": reinstale pelo instalador oficial.

Stack completa em contêineres (banco, migrações e API): `docker compose --profile full up --build`.

### Rotas (todas em `/api/v1`)

Cada arquivo `src/modules/*/http/*.routes.ts` começa com a lista das suas rotas, o perfil de acesso e os RFs atendidos.

| Grupo                     | Rotas                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Autenticação              | `POST /auth/login`, `/auth/refresh`, `/auth/logout`                                                                                                                            |
| Cadastro e perfil         | `POST /atletas`, `POST /olheiros`, `GET /termos`, `GET/PATCH/DELETE /perfil`, `POST /perfil/foto`                                                                              |
| Verificação e vínculo     | `GET/POST /perfil/verificacao`, `POST/GET /vinculos`, `GET /vinculos/pedido`, `POST /responsaveis`                                                                             |
| Lances                    | `GET/POST /videos`, `GET /perfil/videos`, `PATCH/DELETE /videos/:id`, `POST /videos/:id/visualizacoes`                                                                         |
| Atletas                   | `GET /atletas`, `GET /atletas/:id`                                                                                                                                             |
| Avaliações e inscrições   | `GET/POST /avaliacoes`, `GET/PATCH/DELETE /avaliacoes/:id`, `GET /perfil/avaliacoes`, `POST/GET /avaliacoes/:id/inscricoes`, `GET /perfil/inscricoes`, `PATCH /inscricoes/:id` |
| Convites e notificações   | `POST/GET /convites`, `PATCH /convites/:id`, `GET/PATCH /notificacoes`                                                                                                         |
| Denúncias e administração | `POST /denuncias`, `GET /admin/verificacoes`, `GET /admin/verificacoes/:id/documento`, `PATCH /admin/verificacoes/:id`, `GET /admin/denuncias`, `PATCH /admin/denuncias/:id`   |

### Dados de demonstração

`npm run db:demo` recria as contas de teste (todas com a senha `demo12345`), avaliações com datas a partir de hoje, convites, inscrições, avisos e lances. Ele só mexe em contas `@demo.nextpass.app`; rode de novo antes de cada apresentação.

- `olheiro@demo.nextpass.app`: Fabrizio Romano (Palmeiras), olheiro **já verificado** e dono de todas as avaliações.
- `atleta@demo.nextpass.app`: Silas, 17 anos, com responsável, convites pendentes e inscrições.
- `leandro@demo.nextpass.app`: Leandro, 17 anos, ainda sem responsável.
- `responsavel@demo.nextpass.app`: Ana, responsável do Silas.
- `admin@nextpass.app` (`npm run db:seed`): administrador, com a senha do `ADMIN_PASSWORD` do `.env`.

Sem lances reais, o feed usa vídeos de exemplo do MDN (não são de futebol). Para a apresentação, coloque vídeos MP4 de 30 a 60 segundos, gravados com o celular em pé, na pasta `uploads/demo-lances` e rode `npm run db:demo`: eles entram no lugar dos exemplos e continuam lá a cada nova execução.

### Administrador (sem tela, pela API)

O administrador usa a API por um cliente HTTP (ex.: Thunder Client): `POST /auth/login` com `admin@nextpass.app`, depois `GET /admin/verificacoes` (cada pedido traz o link `documento` para abrir o arquivo enviado) e `PATCH /admin/verificacoes/:id` com `{ "status": "APROVADA" }` ou `{ "status": "RECUSADA", "motivoRecusa": "..." }`. As denúncias seguem o mesmo caminho em `/admin/denuncias`.

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
- **Busca (RNF-16):** ignora acentos e maiúsculas e tolera pequenos erros de digitação com as extensões `unaccent` e `pg_trgm` do PostgreSQL. A regra está em `src/shared/domain/busca.ts` (usada pelos testes) e `src/shared/infra/database/busca-textual.ts` (SQL).
- **Documentos de verificação (RNF-09):** ficam em `uploads/documentos`, fora das pastas públicas; só o administrador os abre, pela rota `GET /admin/verificacoes/:id/documento`.
- **Tabelas e campos além da Figura 2:** `Token`, `Usuario.fotoUrl`, `Usuario.termosAceitosEm` (registro do aceite, RF-10), `Vinculo.tokenHash` (link do responsável) e `Avaliacao.local/cidade/uf`. A cidade e a UF ficam separadas do endereço porque aparecem no card, e o endereço completo só depois da confirmação (RN-08).

### Fora do escopo do TCC (trabalhos futuros)

- **Login com Google (RF-04, RF-12)** e **notificações push (RF-53)**: retirados do escopo pela equipe; os avisos ficam dentro do app (`/notificacoes`). A tabela `Dispositivo` e o campo `Usuario.googleId` já existem no banco para essa evolução.
- **E-mail de verdade:** o "Esqueceu sua senha?" é simulado no app (RF-05), e o link de confirmação do responsável (RF-48) aparece no terminal da API (`correio-console.ts`). Para enviar de verdade, basta outra implementação da interface `Correio`.
- **Painel do administrador:** as verificações e as denúncias são analisadas pela API.
- **Armazenamento em nuvem:** os arquivos ficam na pasta `uploads`; em produção, outra implementação de `Armazenamento` (ex.: S3).
