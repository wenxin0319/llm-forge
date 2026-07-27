import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseJsonl, parseCsv, parseParquet, parseText, parseDataset } from './dataset-parsers';

describe('dataset-parsers', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-forge-dataset-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, content: string) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, content);
    return p;
  };

  describe('parseJsonl', () => {
    it('detects chat, alpaca, dpo, and generic formats', async () => {
      const chat = write('chat.jsonl', `${JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })}\n`);
      expect((await parseJsonl(chat)).detectedFormat).toBe('chat');

      const alpaca = write('alpaca.jsonl', `${JSON.stringify({ instruction: 'do x', output: 'y' })}\n`);
      expect((await parseJsonl(alpaca)).detectedFormat).toBe('alpaca');

      const dpo = write('dpo.jsonl', `${JSON.stringify({ prompt: 'p', chosen: 'c', rejected: 'r' })}\n`);
      expect((await parseJsonl(dpo)).detectedFormat).toBe('dpo');

      const generic = write('generic.jsonl', `${JSON.stringify({ text: 'hello' })}\n`);
      expect((await parseJsonl(generic)).detectedFormat).toBe('generic');
    });

    it('skips invalid lines but keeps valid ones when they are the minority', async () => {
      const file = write(
        'mixed.jsonl',
        [JSON.stringify({ text: 'a' }), 'not json', JSON.stringify({ text: 'b' })].join('\n'),
      );
      const result = await parseJsonl(file);
      expect(result.recordCount).toBe(2);
      expect(result.errorMessage).toContain('1 of 3 lines skipped');
    });

    it('flags the file as not JSONL when most lines fail to parse', async () => {
      const file = write('garbage.jsonl', ['not json', 'still not json', JSON.stringify({ text: 'a' })].join('\n'));
      const result = await parseJsonl(file);
      expect(result.errorMessage).toContain("doesn't look like JSONL");
    });

    it('reports an empty file explicitly', async () => {
      const file = write('empty.jsonl', '');
      const result = await parseJsonl(file);
      expect(result).toEqual({ recordCount: 0, errorMessage: 'File is empty' });
    });

    it('rejects a missing file without throwing', async () => {
      await expect(parseJsonl(path.join(dir, 'missing.jsonl'))).rejects.toThrow(/ENOENT/);
    });
  });

  describe('parseCsv', () => {
    it('parses rows and detects columns', async () => {
      const file = write('data.csv', 'a,b\n1,2\n3,4\n');
      const result = await parseCsv(file);
      expect(result.recordCount).toBe(2);
      expect(result.columns).toEqual(['a', 'b']);
    });

    it('reports header-only files as having no data rows', async () => {
      const file = write('header-only.csv', 'a,b\n');
      const result = await parseCsv(file);
      expect(result.recordCount).toBe(0);
      expect(result.errorMessage).toContain('No data rows found');
    });

    it('resolves with an error instead of crashing when the file does not exist', async () => {
      const result = await parseCsv(path.join(dir, 'missing.csv'));
      expect(result.recordCount).toBe(0);
      expect(result.errorMessage).toContain('Could not read file');
    });
  });

  describe('parseParquet', () => {
    it('returns an error result for a non-Parquet file instead of throwing', async () => {
      const file = write('not-really.parquet', 'this is not a parquet file');
      const result = await parseParquet(file);
      expect(result.recordCount).toBe(0);
      expect(result.errorMessage).toContain('Not a valid Parquet file');
    });
  });

  describe('parseText', () => {
    it('counts non-blank lines', async () => {
      const file = write('prompts.txt', 'line one\n\nline two\n   \nline three\n');
      const result = await parseText(file);
      expect(result.recordCount).toBe(3);
    });

    it('reports an empty file explicitly', async () => {
      const file = write('empty.txt', '');
      const result = await parseText(file);
      expect(result).toEqual({ recordCount: 0, errorMessage: 'File is empty' });
    });
  });

  describe('parseDataset', () => {
    it('rejects unsupported types without touching the filesystem', async () => {
      const result = await parseDataset('xml', path.join(dir, 'whatever.xml'));
      expect(result).toEqual({ recordCount: 0, errorMessage: 'Unsupported dataset type: xml' });
    });
  });
});
