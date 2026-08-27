-- =============================================================
--  MIGRAÇÃO 004 — Resposta do avaliador ao questionamento
--  (confirmar sem alteração x corrigir, com motivo da correção)
--  Incremental — rode no SQL Editor do Supabase depois da 003.
-- =============================================================

alter table correcoes add column if not exists motivo_resposta text;

alter table correcoes drop constraint if exists correcoes_status_check;
alter table correcoes add constraint correcoes_status_check
  check (status in ('PENDENTE_CORRECAO', 'CORRIGIDA', 'CONFIRMADA', 'VALIDADA'));
