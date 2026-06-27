/**
 * CSV export utility — no external dependencies.
 * Builds a CSV string from headers + rows, creates a Blob, and triggers
 * a download via a temporary anchor element.
 */

/**
 * Escape a single CSV cell value.
 * Wraps in double quotes if it contains a comma, quote, or newline,
 * and doubles any embedded double quotes.
 */
function escapeCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export an array of rows to a CSV file and trigger a browser download.
 *
 * @param filename - Target file name (e.g. "blocks.csv")
 * @param headers  - Array of column header strings
 * @param rows     - Array of rows, each row an array of cell values
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  const csv = lines.join("\r\n");

  // Prepend BOM so Excel reads UTF-8 correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL on the next tick
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
