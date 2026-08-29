/* =========================================================
   Avaliação Digital 2.0 — Sessão
   ========================================================= */

var SESSION_KEY = "ad2_session";

var Session = {
  save: function (data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  },

  load: function () {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  clear: function () {
    localStorage.removeItem(SESSION_KEY);
  },

  // Garante que existe sessão e que o perfil é um dos permitidos.
  // Se não estiver logado ou o perfil não bater, manda de volta pro login.
  require: function (allowedRoles) {
    var s = this.load();
    if (!s || !s.role) {
      window.location.href = "index.html";
      return null;
    }
    s.role = String(s.role).trim().toLowerCase();
    if (allowedRoles && allowedRoles.map(function (r) { return r.toLowerCase(); }).indexOf(s.role) === -1) {
      window.location.href = "index.html";
      return null;
    }
    return s;
  },

  logout: function () {
    this.clear();
    window.location.href = "index.html";
  },

  roleLabel: function (role) {
    var map = {
      master: "Master",
      admin: "Administrador",
      presidente: "Presidente de mesa",
      avaliador: "Avaliador",
      consultor: "Consultor"
    };
    return map[role] || role;
  },

  initials: function (name) {
    if (!name) return "??";
    var parts = name.trim().split(/\s+/);
    var first = parts[0] ? parts[0][0] : "";
    var last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
};
