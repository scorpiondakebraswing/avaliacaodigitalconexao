// =============================================================
// Hash de senha usando scrypt (nativo do Node — sem precisar de
// nenhuma dependência externa tipo bcrypt).
// =============================================================

const crypto = require('crypto');

function hashSenha(senhaPlana) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senhaPlana), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarSenha(senhaPlana, senhaHash) {
  if (!senhaHash || senhaHash.indexOf(':') === -1) return false;
  const [salt, hashArmazenado] = senhaHash.split(':');
  const hashTentativa = crypto.scryptSync(String(senhaPlana), salt, 64).toString('hex');
  const bufArmazenado = Buffer.from(hashArmazenado, 'hex');
  const bufTentativa = Buffer.from(hashTentativa, 'hex');
  if (bufArmazenado.length !== bufTentativa.length) return false;
  return crypto.timingSafeEqual(bufArmazenado, bufTentativa);
}

module.exports = { hashSenha, verificarSenha };
