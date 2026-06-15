// Normalizacao e validacao de telefones brasileiros para a API LigueLead.
//
// A API LigueLead espera os numeros SEM DDI (ex.: "11999999999"). Aceitamos
// entrada com "+55", "55" ou ja local, e normalizamos TUDO para o formato
// canonico local: DDD + assinante (10 digitos para fixo, 11 para celular).

/**
 * Normaliza um telefone BR para o formato local SEM DDI (10 ou 11 digitos).
 * @param {string} raw
 * @returns {{ ok: true, phone: string } | { ok: false, reason: string }}
 */
export function normalizePhone(raw) {
  if (raw == null) return { ok: false, reason: 'telefone vazio' };

  // Mantem apenas digitos.
  let digits = String(raw).replace(/\D/g, '');

  if (!digits) return { ok: false, reason: 'sem digitos' };

  // Remove DDI 55 para tratar o numero local de forma uniforme.
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Agora `digits` deve ser o numero local: DDD (2) + assinante (8 ou 9).
  if (digits.length !== 10 && digits.length !== 11) {
    return { ok: false, reason: `numero local com ${digits.length} digitos (esperado 10 ou 11)` };
  }

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { ok: false, reason: `DDD invalido (${ddd})` };
  }

  // Celular (11 digitos) deve ter o 9 na frente do assinante.
  if (digits.length === 11 && digits[2] !== '9') {
    return { ok: false, reason: 'celular de 11 digitos sem o 9 inicial' };
  }

  // Formato canonico para a LigueLead: local, sem DDI.
  return { ok: true, phone: digits };
}

/**
 * Normaliza uma lista de telefones, separando validos de invalidos
 * e removendo duplicados (mantendo a ordem de primeira aparicao).
 * @param {string[]} list
 * @returns {{ valid: string[], invalid: Array<{ input: string, reason: string }> }}
 */
export function normalizePhoneList(list) {
  const valid = [];
  const invalid = [];
  const seen = new Set();

  for (const raw of list) {
    const r = normalizePhone(raw);
    if (!r.ok) {
      invalid.push({ input: String(raw), reason: r.reason });
      continue;
    }
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    valid.push(r.phone);
  }

  return { valid, invalid };
}
