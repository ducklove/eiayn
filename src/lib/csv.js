export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Excel treats leading =, +, -, @, tab, CR as a formula; neutralize scraped strings.
  if (typeof value === 'string' && /^[=+@\t\r-]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  if (!headers.length) return null;
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];
  // BOM keeps Korean text readable when the file is opened in Excel.
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
