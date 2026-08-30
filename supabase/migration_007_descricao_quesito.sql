-- =============================================================
--  MIGRAÇÃO 007 — Descrição/definição de cada quesito
--  Incremental — rode no SQL Editor do Supabase depois da 006.
-- =============================================================

alter table quesitos_globais add column if not exists descricao text;
