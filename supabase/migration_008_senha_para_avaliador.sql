-- =============================================================
--  MIGRAÇÃO 008 — Login com senha pra todo mundo (inclusive avaliador)
--  Rode no SQL Editor do Supabase depois da 007.
--
--  Até agora só master/admin/presidente/consultor tinham senha.
--  A partir de agora TODO usuário (incluindo avaliador) precisa de
--  senha pra entrar. Este script garante que ninguém fique travado
--  pra fora do sistema: qualquer usuário que ainda não tenha senha
--  (hoje, isso é basicamente todo avaliador) recebe a senha padrão.
--
--  Senha padrão definida: 123456
-- =============================================================

update usuarios
set senha_hash = '87cf95308c54af7b36b4df666af87021:232e55da77e9b2c8e67b73ce4af192640a558f8df89f2a110c05a9370053a0dd819c372355989e3d280343d8aec5d8e72d1acfec21910ffa4c407262400d9a95'
where senha_hash is null;
