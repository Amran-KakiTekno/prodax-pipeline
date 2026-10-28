import { describe, expect, it } from 'vitest';
import {
  SIMULATED_ADDED_DOCUMENT,
  SIMULATED_ADDED_RECORD,
  SOURCE_DOCUMENTS,
  SOURCE_RECORDS,
} from './data';
import {
  applyIncremental,
  createInitialState,
  resetDemo,
  runInitialLoad,
  selectCheckpoint,
  selectDocumentForRow,
  selectTargetRows,
  simulateSourceChanges,
  type SyncState,
} from './domain';

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

/** Initial load -> source change -> incremental -> repeat incremental. */
function reachSecondIncremental(): SyncState {
  const loaded = runInitialLoad(createInitialState()).state;
  const changed = simulateSourceChanges(loaded);
  const first = applyIncremental(changed).state;
  return applyIncremental(first).state;
}

describe('authored synthetic fixtures', () => {
  it('starts with six source records and three documents', () => {
    expect(SOURCE_RECORDS).toHaveLength(6);
    expect(SOURCE_DOCUMENTS).toHaveLength(3);
  });

  it('links every source record to an existing document', () => {
    const documentIds = new Set(SOURCE_DOCUMENTS.map((document) => document.documentId));
    for (const record of SOURCE_RECORDS) {
      expect(documentIds.has(record.documentId)).toBe(true);
    }
  });

  it('gives every source record a unique id and revision of one', () => {
    const recordIds = SOURCE_RECORDS.map((record) => record.recordId);
    expect(new Set(recordIds).size).toBe(recordIds.length);
    for (const record of SOURCE_RECORDS) {
      expect(record.revision).toBe(1);
    }
  });
});

describe('initial load', () => {
  it('inserts all six source rows and nothing else', () => {
    const outcome = runInitialLoad(createInitialState());

    expect(outcome.result.counts.inserted).toBe(6);
    expect(outcome.result.counts.updated).toBe(0);
    expect(outcome.result.counts.skipped).toBe(0);
    expect(selectTargetRows(outcome.state)).toHaveLength(6);
  });

  it('advances the checkpoint to the first run and revision watermark one', () => {
    const outcome = runInitialLoad(createInitialState());
    const checkpoint = selectCheckpoint(outcome.state);

    expect(checkpoint.runNumber).toBe(1);
    expect(checkpoint.revisionWatermark).toBe(1);
  });

  it('writes an execution log entry for the load', () => {
    const outcome = runInitialLoad(createInitialState());

    expect(outcome.state.log).toHaveLength(1);
    expect(outcome.state.log[0].message).toContain('Initial load');
  });
});

describe('source change simulation', () => {
  it('revises exactly two existing records and adds exactly one new record', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);

    expect(changed.sourceRecords).toHaveLength(7);
    expect(changed.sourceDocuments).toHaveLength(4);

    const revised = changed.sourceRecords.filter(
      (record) => record.revision > 1 && record.recordId !== SIMULATED_ADDED_RECORD.recordId,
    );
    expect(revised).toHaveLength(2);

    const added = changed.sourceRecords.filter(
      (record) => record.recordId === SIMULATED_ADDED_RECORD.recordId,
    );
    expect(added).toHaveLength(1);
    expect(added[0].documentId).toBe(SIMULATED_ADDED_DOCUMENT.documentId);
  });

  it('is idempotent when applied twice', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const once = simulateSourceChanges(loaded);
    const twice = simulateSourceChanges(once);

    expect(snapshot(twice.sourceRecords)).toBe(snapshot(once.sourceRecords));
    expect(twice.sourceDocuments).toHaveLength(4);
  });
});

describe('incremental sync', () => {
  it('inserts one, updates two and skips four on the first pass after the changes', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);
    const outcome = applyIncremental(changed);

    expect(outcome.result.counts.inserted).toBe(1);
    expect(outcome.result.counts.updated).toBe(2);
    expect(outcome.result.counts.skipped).toBe(4);
    expect(selectTargetRows(outcome.state)).toHaveLength(7);
  });

  it('is idempotent: an immediate repeat inserts and updates nothing', () => {
    const state = reachSecondIncremental();
    const outcome = applyIncremental(state);

    expect(outcome.result.counts.inserted).toBe(0);
    expect(outcome.result.counts.updated).toBe(0);
    expect(outcome.result.counts.skipped).toBe(7);
    expect(selectTargetRows(outcome.state)).toHaveLength(7);
  });

  it('skips records whose revision did not advance and leaves them untouched', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);
    const outcome = applyIncremental(changed);

    const unchanged = changed.sourceRecords.filter(
      (record) =>
        record.revision === 1 && record.recordId !== SIMULATED_ADDED_RECORD.recordId,
    );
    expect(unchanged).toHaveLength(4);

    const targetRows = selectTargetRows(outcome.state);
    for (const record of unchanged) {
      const target = targetRows.find((row) => row.recordId === record.recordId);
      expect(target).toBeDefined();
      expect(target?.revision).toBe(1);
      expect(target?.readingValue).toBe(record.readingValue);
    }
  });

  it('advances the checkpoint on every run and the revision watermark only on change', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);
    const first = applyIncremental(changed);
    const second = applyIncremental(first.state);

    expect(selectCheckpoint(first.state).runNumber).toBe(2);
    expect(selectCheckpoint(first.state).revisionWatermark).toBe(2);
    expect(selectCheckpoint(second.state).runNumber).toBe(3);
    expect(selectCheckpoint(second.state).revisionWatermark).toBe(2);
  });

  it('appends one execution log entry per run', () => {
    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);
    const first = applyIncremental(changed);
    const second = applyIncremental(first.state);

    expect(second.state.log.length).toBeGreaterThan(first.state.log.length);
  });
});

describe('document linkage', () => {
  it('resolves the linked synthetic document for a target row', () => {
    const state = reachSecondIncremental();
    const target = selectTargetRows(state).find(
      (row) => row.documentId === SIMULATED_ADDED_DOCUMENT.documentId,
    );

    expect(target).toBeDefined();

    const document = selectDocumentForRow(state, target!.recordId);
    expect(document?.documentId).toBe(SIMULATED_ADDED_DOCUMENT.documentId);
    expect(document?.title).toBe(SIMULATED_ADDED_DOCUMENT.title);
    expect(document?.body.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown record id', () => {
    const state = reachSecondIncremental();

    expect(selectDocumentForRow(state, 'rec-does-not-exist')).toBeUndefined();
  });

  it('links every target row to a resolvable document', () => {
    const state = reachSecondIncremental();

    for (const row of selectTargetRows(state)) {
      expect(selectDocumentForRow(state, row.recordId)).toBeDefined();
    }
  });
});

describe('reset', () => {
  it('restores the initial pre-run state', () => {
    const dirty = reachSecondIncremental();
    const fresh = resetDemo();

    expect(fresh.sourceRecords).toHaveLength(6);
    expect(fresh.sourceDocuments).toHaveLength(3);
    expect(selectTargetRows(fresh)).toHaveLength(0);
    expect(fresh.log).toHaveLength(0);
    expect(selectCheckpoint(fresh).runNumber).toBe(0);
    expect(selectCheckpoint(fresh).revisionWatermark).toBe(0);
    expect(dirty.log.length).toBeGreaterThan(0);
  });
});

describe('fixture immutability', () => {
  it('never mutates the authored fixture constants', () => {
    const recordsBefore = snapshot(SOURCE_RECORDS);
    const documentsBefore = snapshot(SOURCE_DOCUMENTS);

    const loaded = runInitialLoad(createInitialState()).state;
    const changed = simulateSourceChanges(loaded);
    applyIncremental(changed);
    applyIncremental(applyIncremental(changed).state);
    simulateSourceChanges(changed);

    expect(snapshot(SOURCE_RECORDS)).toBe(recordsBefore);
    expect(snapshot(SOURCE_DOCUMENTS)).toBe(documentsBefore);
  });

  it('keeps state rows detached from the fixture objects', () => {
    const state = runInitialLoad(createInitialState()).state;

    expect(state.sourceRecords[0]).not.toBe(SOURCE_RECORDS[0]);
    for (const row of selectTargetRows(state)) {
      const fixture = SOURCE_RECORDS.find((record) => record.recordId === row.recordId);
      expect(row).not.toBe(fixture);
    }
  });
});
