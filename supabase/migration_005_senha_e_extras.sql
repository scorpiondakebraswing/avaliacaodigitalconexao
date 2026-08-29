-- =============================================================
--  MIGRAÇÃO 005 — Senhas, limite de eventos, avaliador com
--  problema, e rascunho automático do voto do avaliador.
--  Incremental — rode no SQL Editor do Supabase depois da 004.
-- =============================================================

-- ---------- Senha (só usada por master/admin/presidente/consultor) ----------
alter table usuarios add column if not exists senha_hash text;

-- ---------- Avaliador marcado como indisponível pelo admin ----------
alter table usuarios add column if not exists com_problema boolean not null default false;
alter table usuarios add column if not exists motivo_problema text;

-- ---------- Limite de eventos por grupo de clientes (definido pelo master) ----------
alter table clientes add column if not exists limite_eventos integer not null default 5;

-- ---------- Rascunho do voto do avaliador (auto-save, não conta na apuração) ----------
create table if not exists rascunhos_voto (
  evento_id text not null references eventos(id) on delete cascade,
  candidata_id text not null,
  codigo text not null,
  quesito_id text not null,
  nota numeric,
  justificativa text,
  atualizado_em timestamptz not null default now(),
  primary key (evento_id, candidata_id, codigo, quesito_id)
);

-- =============================================================
-- Nada disso apaga dados existentes. Usuários que já existem
-- ficam com senha_hash em branco — use o "Redefinir senha"
-- deles pelo Painel Master/Administrador para definir a senha
-- inicial (perfis master/admin/presidente/consultor precisam de
-- senha a partir de agora; avaliador continua só com código).
-- =============================================================
