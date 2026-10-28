/**
 * Pure domain logic for the Pipeline Sync Lab demo.
 *
 * The demo models a two-store ingestion pipeline:
 *   source register  ->  target store
 *
 * `runInitialLoad` rebuilds the target store from the whole source register.
 * `applyIncremental` compares source rows against target rows on
 * `recordId` + `revision` and only touches rows that are new or that moved on.
 * `simulateSourceChanges` produces a changed source register for the demo.
 *
 * Every function is pure: it returns a new state object and never mutates its
 * input, and the authored fixtures in `data.ts` are never mutated either.
 */

import {
  SIMULATED_ADDED_DOCUMENT,
  SIMULATED_ADDED_RECORD,
  SIMULATED_REVISED_RECORD_IDS,
  SIMULATED_REVISIONS,
  SOURCE_DOCUMENTS,
  SOURCE_RECORDS,
  type SourceDocument,
  type SourceRecord,
} from './data';

export type SyncMode = 'initial' | 'incremental' | 'control';

export interface SyncCounts {
  inserted: number;
  updated: number;
  skipped: number;
  processed: number;
}

export interface SyncResult {
  mode: Exclude<SyncMode, 'control'>;
  counts: SyncCounts;
}

export interface Checkpoint {
  /** How many sync runs have been executed since the demo was reset. */
  runNumber: number;
  /** Highest revision currently held in the target store. */
  revisionWatermark: number;
}

export interface LogEntry {
  sequence: number;
  mode: SyncMode;
  message: string;
}

/** A row as it exists in the target store. */
export type TargetRow = SourceRecord;

export interface SyncState {
  sourceRecords: SourceRecord[];
  sourceDocuments: SourceDocument[];
  targetRows: TargetRow[];
  checkpoint: Checkpoint;
  log: LogEntry[];
  lastResult: SyncResult | null;
}

export interface SyncOutcome {
  state: SyncState;
  result: SyncResult;
}

export interface SourceSummary {
  records: number;
  documents: number;
}

export interface TargetSummary {
  rows: number;
}

function cloneRecord(record: SourceRecord): SourceRecord {
  return { ...record };
}

function cloneDocument(document: SourceDocument): SourceDocument {
  return { ...document };
}

function maxRevision(records: readonly SourceRecord[]): number {
  return records.reduce((highest, record) => Math.max(highest, record.revision), 0);
}

function appendLog(log: readonly LogEntry[], mode: SyncMode, message: string): LogEntry[] {
  return [...log, { sequence: log.length + 1, mode, message }];
}

/** The untouched starting point of the demo: six source rows, three documents, empty target. */
export function createInitialState(): SyncState {
  return {
    sourceRecords: SOURCE_RECORDS.map(cloneRecord),
    sourceDocuments: SOURCE_DOCUMENTS.map(cloneDocument),
    targetRows: [],
    checkpoint: { runNumber: 0, revisionWatermark: 0 },
    log: [],
    lastResult: null,
  };
}

/** Restores the initial pre-run state: source counts reset, target emptied, log cleared. */
export function resetDemo(): SyncState {
  return createInitialState();
}

/**
 * Full load: the target store is rebuilt from the whole source register.
 * Every source row counts as inserted; nothing is updated or skipped.
 */
export function runInitialLoad(state: SyncState): SyncOutcome {
  const sourceRecords = state.sourceRecords.map(cloneRecord);
  const targetRows = sourceRecords.map(cloneRecord);

  const counts: SyncCounts = {
    inserted: targetRows.length,
    updated: 0,
    skipped: 0,
    processed: sourceRecords.length,
  };

  const checkpoint: Checkpoint = {
    runNumber: state.checkpoint.runNumber + 1,
    revisionWatermark: maxRevision(targetRows),
  };

  const message =
    `Initial load complete: ${counts.inserted} inserted, ${counts.updated} updated, ` +
    `${counts.skipped} skipped. Target now holds ${targetRows.length} rows.`;

  return {
    state: {
      ...state,
      sourceRecords,
      targetRows,
      checkpoint,
      log: appendLog(state.log, 'initial', message),
      lastResult: { mode: 'initial', counts },
    },
    result: { mode: 'initial', counts },
  };
}

/**
 * Incremental pass: compares source rows against target rows on `recordId` and
 * `revision`. A row is inserted when it is unknown to the target store, updated
 * when its revision advanced, and skipped when the revision did not move.
 */
export function applyIncremental(state: SyncState): SyncOutcome {
  const targetById = new Map(state.targetRows.map((row) => [row.recordId, row]));
  const seen = new Set<string>();

  const targetRows: TargetRow[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const sourceRecord of state.sourceRecords) {
    seen.add(sourceRecord.recordId);
    const existing = targetById.get(sourceRecord.recordId);

    if (!existing) {
      targetRows.push(cloneRecord(sourceRecord));
      inserted += 1;
    } else if (sourceRecord.revision > existing.revision) {
      targetRows.push(cloneRecord(sourceRecord));
      updated += 1;
    } else {
      targetRows.push(cloneRecord(existing));
      skipped += 1;
    }
  }

  // Target rows whose source record disappeared are preserved rather than dropped.
  for (const existing of state.targetRows) {
    if (!seen.has(existing.recordId)) {
      targetRows.push(cloneRecord(existing));
    }
  }

  const counts: SyncCounts = {
    inserted,
    updated,
    skipped,
    processed: state.sourceRecords.length,
  };

  const checkpoint: Checkpoint = {
    runNumber: state.checkpoint.runNumber + 1,
    revisionWatermark: maxRevision(targetRows),
  };

  const message =
    `Incremental sync complete: ${counts.inserted} inserted, ${counts.updated} updated, ` +
    `${counts.skipped} skipped. Target now holds ${targetRows.length} rows.`;

  return {
    state: {
      ...state,
      targetRows,
      checkpoint,
      log: appendLog(state.log, 'incremental', message),
      lastResult: { mode: 'incremental', counts },
    },
    result: { mode: 'incremental', counts },
  };
}

/**
 * Applies the demo's source change: two existing records are revised (their
 * revision advances and their reading is replaced) and one new record arrives
 * with one new document.
 *
 * The simulation is derived from the authored fixtures rather than from the
 * current state, so applying it twice produces the same source register.
 */
export function simulateSourceChanges(state: SyncState): SyncState {
  const sourceRecords: SourceRecord[] = SOURCE_RECORDS.map((record) => {
    if (!SIMULATED_REVISED_RECORD_IDS.includes(record.recordId as never)) {
      return cloneRecord(record);
    }
    const revision = SIMULATED_REVISIONS[record.recordId];
    return {
      ...cloneRecord(record),
      revision: record.revision + 1,
      observedAt: revision.observedAt,
      readingValue: revision.readingValue,
    };
  });

  sourceRecords.push(cloneRecord(SIMULATED_ADDED_RECORD));

  const sourceDocuments: SourceDocument[] = SOURCE_DOCUMENTS.map(cloneDocument);
  sourceDocuments.push(cloneDocument(SIMULATED_ADDED_DOCUMENT));

  const message =
    `Source change simulated: 2 records revised, 1 record added, 1 document added. ` +
    `Source now holds ${sourceRecords.length} rows and ${sourceDocuments.length} documents.`;

  return {
    ...state,
    sourceRecords,
    sourceDocuments,
    log: appendLog(state.log, 'control', message),
  };
}

/* ------------------------------------------------------------------ */
/* Selectors                                                          */
/* ------------------------------------------------------------------ */

export function selectTargetRows(state: SyncState): TargetRow[] {
  return state.targetRows;
}

export function selectCheckpoint(state: SyncState): Checkpoint {
  return state.checkpoint;
}

export function selectSourceSummary(state: SyncState): SourceSummary {
  return { records: state.sourceRecords.length, documents: state.sourceDocuments.length };
}

export function selectTargetSummary(state: SyncState): TargetSummary {
  return { rows: state.targetRows.length };
}

/** The synthetic document linked to a target row, if the row is known. */
export function selectDocumentForRow(
  state: SyncState,
  recordId: string,
): SourceDocument | undefined {
  const row = state.targetRows.find((candidate) => candidate.recordId === recordId);
  if (!row) {
    return undefined;
  }
  return state.sourceDocuments.find((document) => document.documentId === row.documentId);
}
