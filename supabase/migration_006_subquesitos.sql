-- =============================================================
--  MIGRAÇÃO 006 — Quesitos de Quadrilha x Destaques (com subquesitos)
--  Incremental — rode no SQL Editor do Supabase depois da 005.
-- =============================================================
--
--  Continuamos com um catálogo "achatado" de quesitos — cada
--  subquesito de Destaques (ex.: "Desenvoltura" dentro de "Rainha")
--  é, por baixo dos panos, um quesito normal: recebe nota e
--  justificativa do avaliador, tem peso (usado no desempate) e
--  entra na soma com descarte igual a qualquer outro. A única
--  diferença é que ele carrega a que FAMÍLIA pertence (quadrilha
--  ou destaque) e, se for de destaque, a qual GRUPO (Rainha,
--  Marcador, Casal, ou outro que o admin criar).
-- =============================================================

alter table quesitos_globais add column if not exists familia text not null default 'quadrilha';

alter table quesitos_globais drop constraint if exists quesitos_globais_familia_check;
alter table quesitos_globais add constraint quesitos_globais_familia_check
  check (familia in ('quadrilha', 'destaque'));

-- Só usado quando familia = 'destaque' (ex.: "RAINHA", "MARCADOR", "CASAL")
alter table quesitos_globais add column if not exists grupo_pai text;
