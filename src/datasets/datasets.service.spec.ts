import { DatasetsService } from './datasets.service';
import * as parsers from './dataset-parsers';

jest.mock('./dataset-parsers', () => ({
  ...jest.requireActual('./dataset-parsers'),
  parseDataset: jest.fn(),
}));

describe('DatasetsService processUpload', () => {
  const update = jest.fn().mockResolvedValue(undefined);
  const repo = { update } as any;

  beforeEach(() => {
    update.mockClear();
  });

  it('marks the dataset as error instead of leaving it stuck in "processing" when the parser rejects unexpectedly', async () => {
    (parsers.parseDataset as jest.Mock).mockRejectedValue(new Error('disk exploded'));
    const service = new DatasetsService(repo);

    await (service as any).processUpload('ds1', 'jsonl', '/tmp/whatever.jsonl');

    expect(update).toHaveBeenCalledWith(
      'ds1',
      expect.objectContaining({ status: 'error', errorMessage: expect.stringContaining('disk exploded') }),
    );
  });

  it('marks the dataset as ready when parsing succeeds', async () => {
    (parsers.parseDataset as jest.Mock).mockResolvedValue({ recordCount: 3, detectedFormat: 'alpaca' });
    const service = new DatasetsService(repo);

    await (service as any).processUpload('ds2', 'jsonl', '/tmp/whatever.jsonl');

    expect(update).toHaveBeenCalledWith(
      'ds2',
      expect.objectContaining({ status: 'ready', recordCount: 3, detectedFormat: 'alpaca' }),
    );
  });
});
