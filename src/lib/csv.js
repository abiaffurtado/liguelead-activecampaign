// Parser CSV minimo (sem dependencias) para o disparo em massa via upload.
// Suporta cabecalho, separador "," ou ";", aspas duplas e campos com quebra.

/**
 * @param {string} text  conteudo bruto do CSV
 * @returns {{ headers: string[], rows: Record<string,string>[] }}
 */
export function parseCsv(text) {
  const records = tokenize(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}

/**
 * Extrai os telefones de um CSV. Se `column` for informado, usa essa coluna;
 * senao tenta colunas comuns (telefone/phone/celular/fone/numero).
 * @param {string} text
 * @param {string} [column]
 * @returns {string[]}
 */
export function extractPhonesFromCsv(text, column) {
  const { headers, rows } = parseCsv(text);
  const candidates = ['telefone', 'phone', 'celular', 'fone', 'numero', 'whatsapp'];

  let col = column;
  if (!col) {
    col = headers.find((h) => candidates.includes(h.toLowerCase()));
  }
  // Sem cabecalho reconhecido: assume a primeira coluna.
  if (!col && headers.length === 1) col = headers[0];

  if (!col) return [];
  return rows.map((r) => r[col]).filter(Boolean);
}

// Tokeniza respeitando aspas. Detecta separador na primeira linha.
function tokenize(text) {
  const sep = detectSeparator(text);
  const out = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === sep) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); out.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((c) => c !== ''));
}

function detectSeparator(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  return (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
}
