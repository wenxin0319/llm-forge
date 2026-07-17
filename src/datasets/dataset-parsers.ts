import * as fs from 'fs';
import * as readline from 'readline';
import { parse as csvParse } from 'csv-parse';

export interface ParseResult {
  recordCount: number;
  detectedFormat?: string;
  columns?: string[];
  errorMessage?: string;
}

function detectJsonlRecordFormat(obj: unknown): string {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (o.messages || o.conversations) return 'chat';
    if (o.instruction !== undefined && o.output !== undefined) return 'alpaca';
    if (o.prompt !== undefined && o.chosen !== undefined) return 'dpo';
  }
  return 'generic';
}

/** Streams a JSONL file line by line — never loads the whole file into memory. */
export async function parseJsonl(filePath: string): Promise<ParseResult> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let valid = 0;
  let invalid = 0;
  let detectedFormat: string | undefined;

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      valid++;
      if (!detectedFormat) detectedFormat = detectJsonlRecordFormat(obj);
    } catch {
      invalid++;
    }
  }

  const total = valid + invalid;
  if (total === 0) return { recordCount: 0, errorMessage: 'File is empty' };
  if (valid / total < 0.5) {
    return { recordCount: valid, errorMessage: `${invalid} of ${total} lines are not valid JSON — this doesn't look like JSONL` };
  }
  return { recordCount: valid, detectedFormat, errorMessage: invalid > 0 ? `${invalid} of ${total} lines skipped (invalid JSON)` : undefined };
}

/** Streams a CSV file through a real RFC 4180 parser (handles quoting/escaping) — no full-file buffering. */
export async function parseCsv(filePath: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    let count = 0;
    let columns: string[] | undefined;
    const parser = csvParse({ columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });

    fs.createReadStream(filePath)
      .pipe(parser)
      .on('data', (record: Record<string, unknown>) => {
        count++;
        if (!columns) columns = Object.keys(record);
      })
      .on('error', (err) => resolve({ recordCount: count, errorMessage: `CSV parse error: ${err.message}` }))
      .on('end', () => {
        if (count === 0) resolve({ recordCount: 0, errorMessage: 'No data rows found (header only, or empty file)' });
        else resolve({ recordCount: count, columns });
      });
  });
}

/** Reads only the Parquet footer metadata (thrift-encoded) — no row-group data is loaded. */
export async function parseParquet(filePath: string): Promise<ParseResult> {
  try {
    const { asyncBufferFromFile, parquetMetadataAsync, parquetSchema } = await import('hyparquet');
    const file = await asyncBufferFromFile(filePath);
    const metadata = await parquetMetadataAsync(file);
    const schema = parquetSchema(metadata);
    const columns = schema.children?.map((c: { element: { name: string } }) => c.element.name) ?? [];
    return { recordCount: Number(metadata.num_rows), columns };
  } catch (err) {
    return { recordCount: 0, errorMessage: `Not a valid Parquet file: ${(err as Error).message}` };
  }
}

/** Plain text — counts non-blank lines as "records" (e.g. one prompt per line). */
export async function parseText(filePath: string): Promise<ParseResult> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let count = 0;
  for await (const raw of rl) {
    if (raw.trim()) count++;
  }
  if (count === 0) return { recordCount: 0, errorMessage: 'File is empty' };
  return { recordCount: count };
}

export async function parseDataset(type: string, filePath: string): Promise<ParseResult> {
  switch (type) {
    case 'jsonl':
      return parseJsonl(filePath);
    case 'csv':
      return parseCsv(filePath);
    case 'parquet':
      return parseParquet(filePath);
    case 'text':
      return parseText(filePath);
    default:
      return { recordCount: 0, errorMessage: `Unsupported dataset type: ${type}` };
  }
}
