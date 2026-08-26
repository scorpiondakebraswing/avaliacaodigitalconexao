/* =========================================================
   Avaliação Digital 2.0 — Notificações (toast)
   ========================================================= */

var Toast = {
  stack: null,

  ensureStack: function () {
    if (!this.stack) {
      this.stack = document.createElement("div");
      this.stack.className = "toast-stack";
      document.body.appendChild(this.stack);
    }
    return this.stack;
  },

  show: function (message, type) {
    var stack = this.ensureStack();
    var el = document.createElement("div");
    el.className = "toast" + (type ? " is-" + type : "");
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s ease";
      setTimeout(function () { el.remove(); }, 250);
    }, 3400);
  },

  success: function (msg) { this.show(msg, "success"); },
  error: function (msg) { this.show(msg, "error"); },
  info: function (msg) { this.show(msg); }
};
