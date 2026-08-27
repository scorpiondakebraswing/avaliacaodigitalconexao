-- =============================================================
--  MIGRAÇÃO: grupos de clientes (licenciamento) + perfil master
--  + troca segura de código de acesso
-- =============================================================
-- Rode este arquivo no SQL Editor do Supabase DEPOIS do schema.sql
-- original. Ele não apaga nada — só acrescenta a camada nova em
-- cima do que você já tem.
-- =============================================================

-- ---------- CLIENTES (grupos de clientes / licenças) ----------
create table if not exists clientes (
  id text primary key,
  nome text not null,
  data_validade_licenca date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- cliente_id nas tabelas que passam a ser isoladas por cliente ----------
alter table eventos add column if not exists cliente_id text references clientes(id);
alter table quesitos_globais add column if not exists cliente_id text references clientes(id);
alter table grupos_candidatas add column if not exists cliente_id text references clientes(id);
alter table usuarios add column if not exists cliente_id text references clientes(id);

-- ---------- perfil "master" ----------
alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check
  check (perfil in ('master','admin','presidente','avaliador','consultor'));

-- =============================================================
-- Backfill: cria um cliente "padrão" e associa tudo que já existe
-- a ele, pra não quebrar o que você já testou.
-- =============================================================

insert into clientes (id, nome, data_validade_licenca, ativo)
values ('cli-conexao-junina', 'CONEXÃO JUNINA (PADRÃO)', '2030-12-31', true)
on conflict (id) do nothing;

update eventos set cliente_id = 'cli-conexao-junina' where cliente_id is null;
update quesitos_globais set cliente_id = 'cli-conexao-junina' where cliente_id is null;
update grupos_candidatas set cliente_id = 'cli-conexao-junina' where cliente_id is null;
update usuarios set cliente_id = 'cli-conexao-junina' where cliente_id is null and perfil <> 'master';

-- a partir daqui, todo evento/quesito/grupo novo precisa ter cliente_id
alter table eventos alter column cliente_id set not null;
alter table quesitos_globais alter column cliente_id set not null;
alter table grupos_candidatas alter column cliente_id set not null;
-- usuarios.cliente_id continua opcional (fica nulo só para perfil = master)

-- =============================================================
-- Crie seu usuário master (troque o código e o nome antes de rodar)
-- =============================================================
insert into usuarios (codigo, nome, perfil, ativo, cliente_id)
values ('MASTER-2027', 'TROQUE-ESTE-NOME', 'master', true, null)
on conflict (codigo) do nothing;

-- =============================================================
-- Função: troca o código de acesso de um usuário com segurança,
-- migrando as referências em usuario_eventos antes de remover o
-- código antigo (tudo em uma transação só).
-- =============================================================
create or replace function trocar_codigo_usuario(old_codigo text, new_codigo text)
returns void as $$
begin
  if not exists (select 1 from usuarios where codigo = old_codigo) then
    raise exception 'Usuário com código % não encontrado', old_codigo;
  end if;

  if exists (select 1 from usuarios where codigo = new_codigo) then
    raise exception 'Já existe um usuário com o código %', new_codigo;
  end if;

  insert into usuarios (codigo, nome, perfil, ativo, cliente_id)
  select new_codigo, nome, perfil, ativo, cliente_id from usuarios where codigo = old_codigo;

  update usuario_eventos set codigo = new_codigo where codigo = old_codigo;

  delete from usuarios where codigo = old_codigo;
end;
$$ language plpgsql;
