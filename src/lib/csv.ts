export type CsvValue = string | number | boolean | null | undefined;

const UTF8_BOM = '﻿';
const RISKY_PREFIX = /^[=+@\t\r]/;

function escapeCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

  // Prevent spreadsheet formula injection on user-controlled text.
  const raw = RISKY_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(rows: CsvValue[][]) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: CsvValue[][]) {
  // BOM keeps Excel from mangling UTF-8 (wallet names, Chinese text).
  const blob = new Blob([UTF8_BOM, toCsv(rows)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function csvTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}
