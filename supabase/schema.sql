-- =============================================================
--  AVALIAÇÃO DIGITAL 2.0 — Schema Supabase (Postgres)
--  Conexão Junina
-- =============================================================
-- Rode este arquivo inteiro no SQL Editor do Supabase (um projeto
-- novo, vazio, é suficiente). Ele cria as tabelas e já deixa um
-- evento de demonstração cadastrado para você testar o backend
-- antes de apontar o front-end para ele.
-- =============================================================

-- ---------- USUÁRIOS ----------
create table if not exists usuarios (
  codigo text primary key,
  nome text not null,
  perfil text not null check (perfil in ('admin','presidente','avaliador','consultor')),
  ativo boolean not null default true
);

-- ---------- EVENTOS ----------
create table if not exists eventos (
  id text primary key,
  nome text not null,
  status_concurso text not null default 'A_INICIAR' check (status_concurso in ('A_INICIAR','EM_ANDAMENTO','FINALIZADO')),
  data_inicio timestamptz,
  data_fim timestamptz,
  id_ativa text,
  id_preparada text,
  status_sistema text not null default 'AGUARDANDO' check (status_sistema in ('AGUARDANDO','EM_AVALIACAO','INTERROMPIDO')),
  reveal_index integer not null default 0,
  regras jsonb not null default '{
    "notaMin": 8,
    "notaMax": 10,
    "notaTipo": "fracionada",
    "regraDescarte": "maior_e_menor",
    "minCaracteresJustificativa": 10,
    "assinaturaObrigatoria": true
  }'::jsonb
);

-- ---------- ASSOCIAÇÃO USUÁRIO <-> EVENTO ----------
create table if not exists usuario_eventos (
  codigo text not null references usuarios(codigo) on delete cascade,
  evento_id text not null references eventos(id) on delete cascade,
  primary key (codigo, evento_id)
);

-- ---------- CATÁLOGO GERAL DE QUESITOS ----------
create table if not exists quesitos_globais (
  id text primary key,
  nome text not null,
  peso numeric not null default 1,
  ordem integer not null default 1,
  valido_para_todos boolean not null default true
);

create table if not exists quesito_eventos (
  quesito_id text not null references quesitos_globais(id) on delete cascade,
  evento_id text not null references eventos(id) on delete cascade,
  primary key (quesito_id, evento_id)
);

-- ---------- CATÁLOGO GERAL DE GRUPOS/QUADRILHAS ----------
create table if not exists grupos_candidatas (
  id text primary key,
  nome text not null,
  cidade text,
  estado text
);

-- ---------- PARTICIPAÇÃO DE UM GRUPO EM UM EVENTO ----------
create table if not exists evento_candidatas (
  evento_id text not null references eventos(id) on delete cascade,
  id text not null, -- mesmo ID do grupo em grupos_candidatas
  nome text not null,
  cidade text,
  estado text,
  disponibilidade text not null default 'DISPONIVEL',
  status_avaliacao text not null default 'PENDENTE',
  ordem integer not null default 1,
  flag_especial text not null default '',
  status_auditoria text not null default 'PENDENTE',
  primary key (evento_id, id)
);

-- ---------- VOTOS (schema normalizado: 1 linha por voto x quesito) ----------
create table if not exists votos (
  id bigserial primary key,
  evento_id text not null references eventos(id) on delete cascade,
  candidata_id text not null,
  login text not null,
  avaliador_nome text not null,
  perfil text,
  quesito_id text not null,
  nota numeric not null,
  justificativa text not null,
  assinatura text,
  criado_em timestamptz not null default now(),
  unique (evento_id, candidata_id, login, quesito_id)
);

-- ---------- CORREÇÕES / QUESTIONAMENTOS ----------
create table if not exists correcoes (
  id text primary key,
  evento_id text not null references eventos(id) on delete cascade,
  candidata_id text not null,
  login_avaliador text not null,
  nome_avaliador text,
  quesito_id text not null,
  nota_antes numeric,
  justificativa_antes text,
  nota_depois numeric,
  justificativa_depois text,
  motivo text,
  status text not null default 'PENDENTE_CORRECAO' check (status in ('PENDENTE_CORRECAO','CORRIGIDA','VALIDADA')),
  questionada_por text,
  criado_em timestamptz not null default now()
);

-- ---------- LOGS ----------
create table if not exists logs (
  id bigserial primary key,
  evento_id text not null references eventos(id) on delete cascade,
  data timestamptz not null default now(),
  acao text,
  usuario text,
  perfil text,
  detalhe text
);

-- ---------- ENCERRAMENTO (snapshot congelado) ----------
create table if not exists encerramentos (
  id bigserial primary key,
  evento_id text not null references eventos(id) on delete cascade,
  tipo text not null,
  conteudo jsonb,
  criado_em timestamptz not null default now()
);

-- =============================================================
-- Segurança: como todo acesso passa pelas funções serverless da
-- Vercel usando a service_role key (nunca exposta ao navegador),
-- deixamos RLS desabilitado aqui. Se quiser expor o Supabase
-- diretamente ao front-end no futuro, ative RLS em cada tabela e
-- escreva políticas antes de trocar a anon key para uso público.
-- =============================================================

-- =============================================================
-- DADOS DE DEMONSTRAÇÃO (opcional — apague se não quiser)
-- =============================================================

insert into eventos (id, nome, status_concurso, data_inicio, data_fim, id_ativa, status_sistema, regras)
values (
  'evt-1', '26º FESTEJO CEARÁ JUNINO', 'EM_ANDAMENTO',
  '2027-06-10T18:00:00Z', '2027-06-12T23:00:00Z',
  'c2', 'EM_AVALIACAO',
  '{"notaMin":8,"notaMax":10,"notaTipo":"fracionada","regraDescarte":"maior_e_menor","minCaracteresJustificativa":10,"assinaturaObrigatoria":true}'::jsonb
) on conflict (id) do nothing;

insert into usuarios (codigo, nome, perfil, ativo) values
  ('ADM-2027', 'ANA (CONEXÃO JUNINA)', 'admin', true),
  ('PRES-2027', 'UBIRATAM', 'presidente', true),
  ('AVAL-2027', 'HELENA BARBOSA', 'avaliador', true),
  ('AVAL2-2027', 'TAYWAN RAMIRES', 'avaliador', true),
  ('AVAL3-2027', 'GRACINHA', 'avaliador', true),
  ('CONS-2027', 'CONSULTORIA CONEXÃO', 'consultor', true)
on conflict (codigo) do nothing;

insert into usuario_eventos (codigo, evento_id) values
  ('ADM-2027','evt-1'), ('PRES-2027','evt-1'), ('AVAL-2027','evt-1'),
  ('AVAL2-2027','evt-1'), ('AVAL3-2027','evt-1'), ('CONS-2027','evt-1')
on conflict do nothing;

insert into quesitos_globais (id, nome, peso, ordem, valido_para_todos) values
  ('q1','DESENVOLTURA',1,1,true),
  ('q2','CRIATIVIDADE',1,2,true),
  ('q3','SIMPATIA',1,3,true),
  ('q4','ATUAÇÃO',1,4,true)
on conflict (id) do nothing;

insert into grupos_candidatas (id, nome, cidade, estado) values
  ('c1','QUADRILHA ESTRELA DO NORTE','FORTALEZA','CE'),
  ('c2','ARRAIÁ DO VALE','CARUARU','PE'),
  ('c3','SANFONA DE OURO','FEIRA DE SANTANA','BA'),
  ('c4','JUNINA ENCANTO','JUAZEIRO DO NORTE','CE'),
  ('c5','FORRÓ DO SERTÃO','MOSSORÓ','RN')
on conflict (id) do nothing;

insert into evento_candidatas (evento_id, id, nome, cidade, estado, disponibilidade, status_avaliacao, ordem, flag_especial, status_auditoria) values
  ('evt-1','c1','QUADRILHA ESTRELA DO NORTE','FORTALEZA','CE','NAO_DISPONIVEL','FINALIZADA',1,'','AUDITADA'),
  ('evt-1','c2','ARRAIÁ DO VALE','CARUARU','PE','NAO_DISPONIVEL','EM_AVALIACAO',2,'','PENDENTE'),
  ('evt-1','c3','SANFONA DE OURO','FEIRA DE SANTANA','BA','DISPONIVEL','PENDENTE',3,'','PENDENTE'),
  ('evt-1','c4','JUNINA ENCANTO','JUAZEIRO DO NORTE','CE','DISPONIVEL','PENDENTE',4,'','PENDENTE'),
  ('evt-1','c5','FORRÓ DO SERTÃO','MOSSORÓ','RN','DISPONIVEL','PENDENTE',5,'','PENDENTE')
on conflict do nothing;

insert into votos (evento_id, candidata_id, login, avaliador_nome, perfil, quesito_id, nota, justificativa) values
  ('evt-1','c1','AVAL-2027','HELENA BARBOSA','AVALIADOR','q1',9.5,'Boa marcação de compasso e sincronia do grupo.'),
  ('evt-1','c1','AVAL-2027','HELENA BARBOSA','AVALIADOR','q2',9.0,'Figurino criativo, temática bem trabalhada.'),
  ('evt-1','c1','AVAL-2027','HELENA BARBOSA','AVALIADOR','q3',10,'Grupo interagiu muito bem com a plateia.'),
  ('evt-1','c1','AVAL-2027','HELENA BARBOSA','AVALIADOR','q4',9.5,'Atuação convincente do casal de noivos.'),
  ('evt-1','c1','AVAL2-2027','TAYWAN RAMIRES','AVALIADOR','q1',9.0,'Coreografia consistente, pequenas falhas de sincronia.'),
  ('evt-1','c1','AVAL2-2027','TAYWAN RAMIRES','AVALIADOR','q2',9.5,'Cenário e adereços muito criativos.'),
  ('evt-1','c1','AVAL2-2027','TAYWAN RAMIRES','AVALIADOR','q3',9.5,'Ótima empolgação do grupo.'),
  ('evt-1','c1','AVAL2-2027','TAYWAN RAMIRES','AVALIADOR','q4',9.0,'Atuação sólida, com bom timing cômico.'),
  ('evt-1','c1','AVAL3-2027','GRACINHA','AVALIADOR','q1',8.5,'Alguns desencontros na parte final da coreografia.'),
  ('evt-1','c1','AVAL3-2027','GRACINHA','AVALIADOR','q2',9.0,'Boa proposta visual do grupo.'),
  ('evt-1','c1','AVAL3-2027','GRACINHA','AVALIADOR','q3',9.5,'Grupo animado do início ao fim.'),
  ('evt-1','c1','AVAL3-2027','GRACINHA','AVALIADOR','q4',9.0,'Atuação convincente, boa expressividade.')
on conflict do nothing;
