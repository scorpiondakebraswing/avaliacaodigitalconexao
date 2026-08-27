# Migração para GitHub + Supabase + Vercel

Você já tem: repositório no GitHub, projeto Supabase criado e vinculado, projeto Vercel criado e vinculado ao repositório. Falta: colocar o código do backend no repositório, criar as tabelas no Supabase, configurar as variáveis de ambiente na Vercel, e apontar o front-end (que já está no cPanel) para a nova API.

## 1. Adicionar os arquivos ao repositório

Copie estas pastas/arquivos para a raiz do seu repositório GitHub (mantendo os caminhos):

```
seu-repo/
├── api/
│   └── action.js
├── lib/
│   ├── supabaseAdmin.js
│   └── regras.js
├── supabase/
│   └── schema.sql       (não precisa ir pro deploy, é só referência)
├── package.json
├── vercel.json
└── .env.example
```

`api/action.js` é o único endpoint HTTP: a Vercel publica automaticamente qualquer arquivo dentro de `api/` como uma função serverless em `/api/<nome-do-arquivo>`. Então esse arquivo vira `https://SEU-PROJETO.vercel.app/api/action`.

Dê commit e push. A Vercel vai começar a rodar o deploy sozinha (é esse o "vinculei com a Vercel" que você já fez).

## 2. Criar as tabelas no Supabase

1. No painel do Supabase, abra **SQL Editor**.
2. Cole todo o conteúdo de `supabase/schema.sql` e rode.
3. Isso cria as tabelas (`usuarios`, `eventos`, `quesitos_globais`, `grupos_candidatas`, `evento_candidatas`, `votos`, `correcoes`, `logs`, `encerramentos`) e já deixa um evento de demonstração (`evt-1`) cadastrado, com os mesmos códigos de acesso do modo demo (`ADM-2027`, `PRES-2027`, `AVAL-2027`, `CONS-2027`) — bom para testar antes de cadastrar seu evento real.
4. Se não quiser os dados de demonstração, apague os blocos `insert into ...` no fim do arquivo antes de rodar (ou rode tudo e depois vá no Painel do Administrador do sistema e apague/edite pela interface).
5. **Depois**, rode também `supabase/migration_002_clientes.sql` (num novo comando no SQL Editor). Esse arquivo adiciona a camada de **Master / Grupos de clientes com licença**: cria a tabela `clientes`, adiciona a coluna `cliente_id` em `usuarios`/`eventos`/`quesitos_globais`/`grupos_candidatas`, e cria um usuário `MASTER-2027` que enxerga e gerencia todos os grupos de clientes. É incremental — não apaga nada do que já existe, só organiza os dados atuais dentro de um cliente padrão chamado "CONEXÃO JUNINA (PADRÃO)".

## 3. Configurar as variáveis de ambiente na Vercel

1. No Supabase: **Project Settings → API**. Copie:
   - `Project URL` → isso é o `SUPABASE_URL`
   - `service_role` **secret** key → isso é o `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca coloque essa chave em código versionado, nem em nenhum arquivo do front-end — ela dá acesso total ao banco)
2. No projeto da Vercel: **Settings → Environment Variables**. Adicione as duas:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Refaça o deploy (a Vercel geralmente pede um novo deploy depois de mudar env vars — pode ser só clicar em "Redeploy" no último deployment).

## 4. Testar o backend antes de plugar no front-end

Com o deploy pronto, teste direto pelo terminal (troque a URL pela sua):

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/action \
  -H "Content-Type: application/json" \
  -d '{"action":"login","codigo":"ADM-2027"}'
```

Se vier `{"success":true,"usuario":{...}}`, o backend está funcionando.

## 5. Apontar o front-end (cPanel) para a nova API

No pacote do front-end que você já subiu no cPanel, os arquivos que precisam ser atualizados estão prontos na pasta `cpanel-updates/` deste pacote:

- `index.html` — agora também redireciona corretamente o perfil `master` para `master.html` após o login.
- `master.html` — **arquivo novo**: o Painel Master (grupos de clientes, licença, usuários).
- `admin.html` — atualizado: todas as ações agora informam o `cliente_id`, o botão "Trocar código de acesso" foi adicionado, e "+ Novo evento" cria um evento de verdade no Supabase.
- `assets/js/config.js` — troque `API_URL` pela URL da sua função (`https://SEU-PROJETO.vercel.app/api/action`) e `EVENT_ID` pelo ID do evento real.
- `assets/js/api.js`, `assets/js/session.js`, `assets/js/shell.js`, `assets/js/toast.js`, `assets/js/mock-data.js` — atualizados (perfil master, sessão, navegação).
- `assets/css/style.css` — ajustes de conforto em telas pequenas (celular/tablet): botões e campos maiores para toque, tabelas com rolagem suave, e os campos de formulário não disparam mais aquele zoom automático chato do iPhone ao tocar neles.

Suba tudo isso por cima dos arquivos antigos no cPanel (mantendo os mesmos caminhos) e dê Ctrl+F5 no navegador para não pegar versão em cache.

A partir daí, todo o sistema (login, votação, apuração, telão, painel do administrador) passa a gravar direto no Supabase, em vez da planilha do Google.

## 6. O que fazer com o Google Apps Script / Planilha

Não precisa apagar nada imediatamente. Recomendo manter o Apps Script publicado como fallback por um tempo (você pode voltar a apontar o `API_URL` pra ele se algo der errado no Supabase), e só descontinuar de vez depois de rodar um evento real de teste completo na stack nova.

## 7. Master, grupos de clientes e licença

A partir da migração 002, existe um quarto perfil: **master**. Ele não pertence a nenhum grupo de clientes — enxerga e gerencia todos.

1. Logue com `MASTER-2027` (crie um código melhor depois, pela própria tela — veja "Trocar código de acesso" no painel).
2. No **Painel Master**, crie um "Grupo de clientes" pra cada festival/organização que for usar a plataforma, definindo o **nome** e a **data de validade da licença**.
3. Dentro do grupo, crie o primeiro usuário **Administrador** daquele cliente. É esse admin que, depois, entra no próprio Painel do Administrador e cadastra os eventos, quesitos, grupos/candidatas e demais usuários (presidente, avaliadores, consultores) daquele cliente específico.
4. Quando a `data de validade da licença` de um grupo passar, todos os usuários dele (menos o master) ficam impedidos de logar, com uma mensagem clara pedindo para contatar o master.
5. Use o botão **Editar → Trocar código de acesso** (tanto no Painel Master quanto no Painel do Administrador) sempre que precisar renomear o código de alguém — nunca edite a coluna `codigo` direto pela tabela do Supabase, porque isso quebra a referência com os eventos que aquele usuário acessa (o Supabase corretamente bloqueia essa edição direta).

## 8. Próximos passos naturais dessa migração

- **Domínio próprio para a API**: hoje a URL fica em `algo.vercel.app`; se quiser, dá pra configurar um subdomínio seu (ex.: `api.conexaojunina.com.br`) apontando pra Vercel.
- **Autenticação mais forte**: hoje o login por "código" consulta a tabela `usuarios` direto — funciona bem para o formato atual do sistema. Se um dia quiser adicionar senha, dá pra estender a tabela `usuarios` com um hash de senha sem mudar o resto do contrato.
- **RLS (Row Level Security)**: como todo acesso hoje passa pela função serverless com a `service_role` key, o Supabase está com RLS desligado — é seguro porque a chave nunca é exposta ao navegador. Se no futuro quiser que o front-end fale direto com o Supabase (sem passar pela Vercel), aí sim precisa ligar RLS e escrever políticas antes.
