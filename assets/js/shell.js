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
    master: [
      { href: "master.html", label: "👑 Painel master" }
    ],
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
    this._bindTrocarSenha(session);
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

  _bindTrocarSenha: function (session) {
    var btn = document.querySelector("[data-trocar-senha]");
    if (!btn) return;

    if (!document.getElementById("modalTrocarSenhaShell")) {
      var modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.id = "modalTrocarSenhaShell";
      modal.innerHTML =
        '<div class="modal">' +
          '<div class="modal__head">' +
            '<h2 class="card__title">Trocar minha senha</h2>' +
            '<button class="modal__close" id="fecharModalTrocarSenhaShell">&times;</button>' +
          "</div>" +
          '<div class="form-field"><label for="senhaAtualShell">Senha atual</label><input type="password" id="senhaAtualShell" autocomplete="current-password"></div>' +
          '<div class="form-field"><label for="novaSenhaShell">Nova senha</label><input type="password" id="novaSenhaShell" placeholder="Pelo menos 6 caracteres" autocomplete="new-password"></div>' +
          '<div class="form-field"><label for="confirmarSenhaShell">Confirmar nova senha</label><input type="password" id="confirmarSenhaShell" autocomplete="new-password"></div>' +
          '<button class="btn btn-primary btn-block" id="confirmarTrocarSenhaShell">Salvar nova senha</button>' +
        "</div>";
      document.body.appendChild(modal);

      document.getElementById("fecharModalTrocarSenhaShell").addEventListener("click", function () {
        modal.classList.remove("is-open");
      });
      modal.addEventListener("click", function (e) {
        if (e.target === modal) modal.classList.remove("is-open");
      });

      document.getElementById("confirmarTrocarSenhaShell").addEventListener("click", function () {
        var atual = document.getElementById("senhaAtualShell").value;
        var nova = document.getElementById("novaSenhaShell").value;
        var confirmar = document.getElementById("confirmarSenhaShell").value;
        if (!atual || !nova) { Toast.error("Preencha todos os campos."); return; }
        if (nova !== confirmar) { Toast.error("A confirmação não bate com a nova senha."); return; }
        if (nova.length < 6) { Toast.error("A nova senha precisa ter pelo menos 6 caracteres."); return; }

        Api.call("trocar_minha_senha", { codigo: session.codigo, senhaAtual: atual, novaSenha: nova }).then(function (res) {
          if (res.success) {
            Toast.success(res.message);
            modal.classList.remove("is-open");
            document.getElementById("senhaAtualShell").value = "";
            document.getElementById("novaSenhaShell").value = "";
            document.getElementById("confirmarSenhaShell").value = "";
          } else {
            Toast.error(res.message);
          }
        });
      });
    }

    btn.addEventListener("click", function () {
      document.getElementById("modalTrocarSenhaShell").classList.add("is-open");
    });
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
