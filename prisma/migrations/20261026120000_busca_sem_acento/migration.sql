-- RNF-16: a busca ignora acentos (unaccent) e tolera pequenos erros de
-- digitação (pg_trgm). As duas extensões vêm com o PostgreSQL e podem ser
-- criadas pelo dono do banco, sem superusuário.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
