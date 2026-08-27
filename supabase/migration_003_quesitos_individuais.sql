-- =============================================================
--  MIGRAÇÃO 003 — Avaliador de quesitos individuais
--  Incremental — rode no SQL Editor do Supabase depois da 002.
-- =============================================================

alter table usuarios add column if not exists avaliador_individual boolean not null default false;

create table if not exists usuario_evento_quesitos (
  codigo text not null references usuarios(codigo) on delete cascade,
  evento_id text not null references eventos(id) on delete cascade,
  quesito_id text not null,
  primary key (codigo, evento_id, quesito_id)
);

-- Atualiza a função de troca de código pra também migrar as
-- restrições de quesito por evento (senão elas se perderiam
-- quando alguém trocasse o próprio código de acesso).
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

  insert into usuarios (codigo, nome, perfil, ativo, cliente_id, avaliador_individual)
  values (upper(new_codigo), u.nome, u.perfil, u.ativo, u.cliente_id, u.avaliador_individual);

  update usuario_eventos set codigo = upper(new_codigo) where codigo = u.codigo;
  update usuario_evento_quesitos set codigo = upper(new_codigo) where codigo = u.codigo;

  delete from usuarios where codigo = u.codigo;
end;
$$ language plpgsql;
