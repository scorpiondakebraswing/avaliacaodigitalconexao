/* =========================================================
   Avaliação Digital 2.0 — Comportamento comum do app-shell
   (sidebar mobile, dados do usuário logado, logout, aviso de
   modo demo). Cada página chama Shell.init(session) depois
   de validar a sessão com Session.require([...]).
   ========================================================= */

var Shell = {

  // Itens de menu disponíveis por perfil. O admin vê tudo; os demais
  // perfis veem só a própria área — mas SEMPRE o conjunto completo do
  // perfil, em qualquer página, não só na página atual.
  NAV_BY_ROLE: {
    admin: [
      { href: "admin.html", label: "🛠️ Painel do administrador" },
      { href: "consultor.html", label: "👁️ Acompanhamento" }
    ],
    presidente: [
      { href: "presidente.html", label: "📋 Painel da presidência" }
    ],
    avaliador: [
      { href: "avaliador.html", label: "🗳️ Votação" }
    ],
    consultor: [
      { href: "consultor.html", label: "👁️ Acompanhamento" }
    ]
  },

  init: function (session) {
    this._fillUser(session);
    this._buildNav(session);
    this._bindLogout();
    this._bindMobileToggle();
    this._demoRibbon();
  },

  _buildNav: function (session) {
    var nav = document.querySelector("[data-app-nav]");
    if (!nav) return;

    var role = String(session.role || "").trim().toLowerCase();
    var items = this.NAV_BY_ROLE[role] || [];
    var currentPage = window.location.pathname.split("/").pop() || "index.html";

    nav.innerHTML = items.map(function (item) {
      var active = item.href === currentPage ? " is-active" : "";
      return '<a href="' + item.href + '" class="' + active.trim() + '">' + item.label + "</a>";
    }).join("");
  },

  _fillUser: function (session) {
    var nameEl = document.querySelector("[data-user-name]");
    var roleEl = document.querySelector("[data-user-role]");
    var avatarEl = document.querySelector("[data-user-avatar]");
    var eventNameEl = document.querySelector("[data-event-name]");

    if (nameEl) nameEl.textContent = session.nome;
    if (roleEl) roleEl.textContent = Session.roleLabel(session.role);
    if (avatarEl) avatarEl.textContent = Session.initials(session.nome);
    if (eventNameEl) eventNameEl.textContent = session.eventoNome || "Evento atual";
  },

  _bindLogout: function () {
    var btn = document.querySelector("[data-logout]");
    if (btn) {
      btn.addEventListener("click", function () {
        Session.logout();
      });
    }
  },

  _bindMobileToggle: function () {
    var toggle = document.querySelector("[data-sidebar-toggle]");
    var sidebar = document.querySelector(".app-sidebar");
    var overlay = document.querySelector("[data-sidebar-overlay]");
    if (!toggle || !sidebar) return;

    function close() {
      sidebar.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-open");
    }

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("is-open");
      if (overlay) overlay.classList.toggle("is-open");
    });

    if (overlay) overlay.addEventListener("click", close);
  },

  _demoRibbon: function () {
    if (!Api.isDemo()) return;
    var ribbon = document.createElement("div");
    ribbon.className = "demo-ribbon";
    ribbon.textContent = "Modo demonstração — dados fictícios salvos só neste navegador. Conecte o backend em assets/js/config.js.";
    document.body.insertBefore(ribbon, document.body.firstChild);
  }
};
