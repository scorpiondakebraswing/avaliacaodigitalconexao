-- =============================================================
--  MIGRAÇÃO 002 — Camada de Master / Clientes (licenciamento)
--  Rode isso no SQL Editor do Supabase. É incremental: não apaga
--  nada do que já existe, só adiciona a estrutura nova por cima.
-- =============================================================

-- ---------- CLIENTES (cada licença/contratante da plataforma) ----------
create table if not exists clientes (
  id text primary key,
  nome text not null,
  data_validade_licenca date not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- se a tabela já existia sem a coluna "ativo" (versão anterior deste
-- arquivo), este comando adiciona ela sem apagar nada:
alter table clientes add column if not exists ativo boolean not null default true;

-- ---------- Backfill: cria um cliente padrão para os dados que já existem ----------
insert into clientes (id, nome, data_validade_licenca)
values ('cliente-conexao', 'CONEXÃO JUNINA (PADRÃO)', '2030-12-31')
on conflict (id) do nothing;

-- ---------- USUARIOS: cliente_id + perfil "master" ----------
alter table usuarios add column if not exists cliente_id text references clientes(id);
update usuarios set cliente_id = 'cliente-conexao' where cliente_id is null;

alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check
  check (perfil in ('master','admin','presidente','avaliador','consultor'));

-- Um "master" não pertence a nenhum cliente (enxerga todos);
-- todo mundo que não é master tem que pertencer a um cliente.
alter table usuarios drop constraint if exists usuarios_cliente_coerente;
alter table usuarios add constraint usuarios_cliente_coerente
  check ((perfil = 'master' and cliente_id is null) or (perfil <> 'master' and cliente_id is not null));

-- usuário master inicial — troque o código antes de usar em produção de verdade
insert into usuarios (codigo, nome, perfil, ativo, cliente_id)
values ('MASTER-2027', 'MASTER CONEXÃO JUNINA', 'master', true, null)
on conflict (codigo) do nothing;

-- ---------- EVENTOS: agora pertencem a um cliente ----------
alter table eventos add column if not exists cliente_id text references clientes(id);
update eventos set cliente_id = 'cliente-conexao' where cliente_id is null;
alter table eventos alter column cliente_id set not null;

-- ---------- QUESITOS GLOBAIS e GRUPOS: viram catálogo POR CLIENTE ----------
-- (antes eram compartilhados por toda a plataforma; agora cada cliente
-- tem o seu próprio catálogo, sem ver o de outro cliente)
alter table quesitos_globais add column if not exists cliente_id text references clientes(id);
update quesitos_globais set cliente_id = 'cliente-conexao' where cliente_id is null;
alter table quesitos_globais alter column cliente_id set not null;

alter table grupos_candidatas add column if not exists cliente_id text references clientes(id);
update grupos_candidatas set cliente_id = 'cliente-conexao' where cliente_id is null;
alter table grupos_candidatas alter column cliente_id set not null;

-- =============================================================
-- Função de troca segura de código de acesso.
-- Cria o usuário com o código novo (mesmos dados), migra os vínculos
-- de evento (usuario_eventos), e só então apaga o registro antigo —
-- tudo em uma única transação (se algo falhar no meio, nada muda).
-- =============================================================
create or replace function trocar_codigo_usuario(old_codigo text, new_codigo text)
returns void as $$
declare
  u usuarios%rowtype;
begin
  select * into u from usuarios where upper(codigo) = upper(old_codigo);

  if not found then
    raise exception 'Usuário com código % não encontrado', old_codigo;
  end if;

  if exists (select 1 from usuarios where upper(codigo) = upper(new_codigo)) then
    raise exception 'Já existe um usuário com o código %', new_codigo;
  end if;

  insert into usuarios (codigo, nome, perfil, ativo, cliente_id)
  values (upper(new_codigo), u.nome, u.perfil, u.ativo, u.cliente_id);

  update usuario_eventos set codigo = upper(new_codigo) where codigo = u.codigo;

  delete from usuarios where codigo = u.codigo;
end;
$$ language plpgsql;

-- =============================================================
-- Pronto. A partir daqui:
--   * "MASTER-2027" loga e cai no painel do master (cria clientes,
--     define validade de licença, cria/edita usuários de cada cliente).
--   * Os usuários que já existiam continuam funcionando normalmente,
--     todos dentro do cliente "cliente-conexao".
--   * Se a licença de um cliente vencer, os usuários dele (menos o
--     master) não conseguem mais logar até alguém renovar a data.
-- =============================================================
