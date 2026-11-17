const { hash } = require('./prayer-domain.cjs');

function emailConfig(env = process.env) {
  const address = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const omar = address(env.LLDB_RECOVERY_OMAR_EMAIL);
  const ever = address(env.LLDB_RECOVERY_EVER_EMAIL);
  const valid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  const from = address(env.LLDB_RECOVERY_FROM_EMAIL);
  if (!env.LLDB_RECOVERY_RESEND_KEY || !valid(from) || !(valid(omar) || valid(ever)) || omar && omar === ever) return null;
  return { key: env.LLDB_RECOVERY_RESEND_KEY, from, recipients: Object.assign(Object.create(null),
    { 'omar-rivera': valid(omar) ? omar : '', 'ever-caraballo': valid(ever) ? ever : '' }) };
}

async function sendRecoveryEmail(config, ticket, request = fetch) {
  const link = new URL('https://www.lluviadebendicion.com/recuperar-acceso');
  link.hash = new URLSearchParams({ usuario: ticket.id, enlace: ticket.code }).toString();
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json',
      'Idempotency-Key': 'lldb-recovery-' + hash(ticket.code) },
    body: JSON.stringify({ from: `Lluvia de Bendición <${config.from}>`, to: [ticket.email],
      subject: 'Recuperación de acceso al Panel Maestro',
      text: `Abre este enlace para elegir una contraseña nueva para tu cuenta del Panel Maestro:\n\n${link.href}\n\nEl enlace vence en 30 minutos y solo puede usarse una vez. Si no lo solicitaste, puedes ignorar este mensaje.` }),
    signal: AbortSignal.timeout(3500)
  });
  if (!response.ok) throw new Error('RECOVERY_MAIL_' + response.status);
}

module.exports = { emailConfig, sendRecoveryEmail };
