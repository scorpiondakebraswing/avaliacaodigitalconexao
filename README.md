# Avaliação Digital 2.0 — Pacote de deploy

Este pacote contém o front-end completo (pronto para subir na `public_html` do cPanel) e o backend em Google Apps Script.

## O que tem aqui

```
/
├── index.html          → tela de login (todos os perfis entram por aqui)
├── admin.html          → painel do Administrador
├── presidente.html     → painel do Presidente de Mesa
├── avaliador.html      → tela de votação do Avaliador
├── consultor.html      → tela de acompanhamento (somente leitura) do Consultor
├── telao.html          → tela de revelação para projetar no telão
├── assets/
│   ├── css/style.css   → design system compartilhado por todas as telas
│   └── js/
│       ├── config.js       → onde você cola a URL do backend (Apps Script)
│       ├── session.js      → controle de sessão do usuário logado
│       ├── api.js          → fala com o backend real OU com os dados de demonstração
│       ├── mock-data.js    → dados fictícios usados enquanto não há backend
│       ├── toast.js        → notificações
│       └── shell.js        → comportamento comum do menu lateral
└── backend/
    └── Code.gs          → código do backend (Google Apps Script)
```

## 1. Publicar o front-end no cPanel (funciona sozinho, em modo demo)

1. Compacte a pasta inteira (ou envie os arquivos individualmente pelo Gerenciador de Arquivos do cPanel).
2. Envie tudo para dentro de `public_html/avaliacaodigital/` (crie essa subpasta se quiser manter em `conexaojunina.com.br/avaliacaodigital`).
3. Pronto — acessando `conexaojunina.com.br/avaliacaodigital/`, o sistema já funciona **em modo demonstração**: todo o clique, navegação e cálculo de notas roda com dados fictícios guardados no navegador (não é multiusuário real ainda). É útil para você e o cliente novo testarem a experiência antes de ligar o backend de verdade.

Códigos de acesso de demonstração (tela de login):

| Código | Perfil |
|---|---|
| `ADM-2027` | Administrador |
| `PRES-2027` | Presidente de mesa |
| `AVAL-2027` | Avaliador |
| `CONS-2027` | Consultor |

Para reiniciar os dados de demonstração, abra o console do navegador (F12) e rode `localStorage.clear()`, depois recarregue a página.

## 2. Ligar o backend real (Google Apps Script + Sheets)

Enquanto o front-end estiver em modo demo, nada é salvo de verdade nem é multiusuário (cada navegador tem seus próprios dados fictícios). Para rodar um evento de verdade, com vários avaliadores votando ao mesmo tempo:

### 2.1 Criar a planilha master (registro de eventos, usuários e catálogos gerais)

1. Crie uma planilha nova no Google Sheets, chame de por exemplo **"Avaliação Digital 2.0 — Master"**.
2. Crie a aba **Usuarios** com o cabeçalho:
   `Codigo | Nome | Perfil | EventosPermitidos | Ativo`
   - `Perfil` deve ser um de: `admin`, `presidente`, `avaliador`, `consultor` (minúsculo).
   - `EventosPermitidos` é o(s) ID(s) de evento que aquele usuário pode acessar, separados por vírgula.
   - `Ativo` = `TRUE` ou `FALSE`. Usuários com `FALSE` não conseguem fazer login — o Painel do Administrador tem um botão "Ativar/Desativar" que controla essa coluna.
3. Crie a aba **Eventos** com o cabeçalho:
   `EventoID | Nome | SpreadsheetID | StatusConcurso | DataInicio | DataFim`
   - `SpreadsheetID` é o ID da planilha daquele evento específico (ver próximo passo).
   - `StatusConcurso` começa como `A_INICIAR`.
   - `DataInicio`/`DataFim` controlam quando avaliadores e presidentes de mesa enxergam o evento como disponível.
4. Crie a aba **QuesitosGlobais** com o cabeçalho:
   `ID | Nome | Peso | Ordem | ValidoParaTodos | EventosAplicaveis`
   - Catálogo único de quesitos, reaproveitável entre eventos. `ValidoParaTodos` = `TRUE`/`FALSE`; se `FALSE`, `EventosAplicaveis` lista os `EventoID` (separados por vírgula) em que aquele quesito vale.
5. Crie a aba **GruposCandidatas** com o cabeçalho:
   `ID | Nome | Cidade | Estado`
   - Catálogo único de quadrilhas/grupos. Cada evento associa um subconjunto desses grupos (feito pelo Painel do Administrador, aba Eventos → Editar).

### 2.2 Criar a planilha-template de um evento

Para cada evento/festival novo, duplique uma planilha com estas abas:

- `Config` (linha 2: candidata ativa / status do sistema / candidata preparada / índice de revelação do telão / regras de apuração em JSON)
- `Candidatas` (participação daquele evento: `ID | Nome | Cidade | Estado | Disponibilidade | StatusAvaliacao | Ordem | FlagEspecial | StatusAuditoria` — populada automaticamente quando o admin associa grupos ao evento)
- `Votos`
- `Correcoes_ADM`
- `Logs`
- `Encerramento_Concurso`

Copie o ID dessa planilha (da URL) para a coluna `SpreadsheetID` na aba `Eventos` da planilha master.

### 2.3 Publicar o backend

1. Abra a planilha **master** → **Extensões → Apps Script**.
2. Apague o conteúdo padrão e cole o conteúdo de `backend/Code.gs`.
3. No topo do arquivo, troque:
   ```js
   var MASTER_SHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA_MASTER";
   ```
   pelo ID da própria planilha master.
4. **Implantar → Nova implantação → tipo "Aplicativo da Web"**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Copie a URL gerada (termina em `/exec`).

### 2.4 Conectar o front-end ao backend

Edite `assets/js/config.js` e troque:

```js
window.APP_CONFIG = {
  API_URL: "REPLACE_ME_APPS_SCRIPT_URL",   // <- cole a URL do passo 2.3 aqui
  EVENT_ID: "demo-2027",                    // <- troque pelo EventoID cadastrado na aba Eventos
  ...
};
```

Suba o arquivo atualizado para o cPanel (sobrescrevendo o antigo). A partir daí, o sistema deixa de usar dados fictícios e passa a gravar de verdade na planilha do evento.

## 3. Cadastrar candidatas, quesitos e usuários de um evento real

- **Quesitos** (catálogo geral, reaproveitável entre eventos): pelo Painel do Administrador, aba "Quesitos" — ou direto na aba `QuesitosGlobais` da planilha master.
- **Grupos/candidatas** (catálogo geral): pelo Painel do Administrador, aba "Candidatas / Grupos" — ou direto na aba `GruposCandidatas` da planilha master.
- **Associar grupos e datas a um evento específico**: pelo Painel do Administrador, aba "Eventos" → botão "Editar" — escolha quais grupos participam, o período do evento e as regras de apuração.
- **Usuários**: pelo Painel do Administrador, aba "Usuários" (inclui botão "Editar" para ajustar quais eventos cada usuário acessa) — ou direto na aba `Usuarios` da planilha master.

## 4. Onboarding de um novo cliente/evento (2027 e além)

1. Duplique a planilha-template de evento (passo 2.2).
2. Adicione uma linha na aba `Eventos` da planilha master com o novo `EventoID`.
3. Cadastre os usuários daquele evento na aba `Usuarios`, associando-os ao novo `EventoID`.
4. Nenhuma alteração de código é necessária — é a mesma instalação de front-end e o mesmo backend atendendo múltiplos eventos ao mesmo tempo.

## 5. Dúvidas de arquitetura / regras de negócio

Veja os documentos já entregues:

- `CODEDUMP.md` — como o V1 funcionava e a lógica de negócio (descarte de notas, desempate, fluxo de correção).
- `BLUEPRINT.md` — arquitetura da V2.0.
- `PRD.md` — requisitos completos.
