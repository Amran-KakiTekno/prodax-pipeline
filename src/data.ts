/**
 * Authored fixtures for the Pipeline Sync Lab demo.
 *
 * Everything in this file is invented for demonstration purposes. The records
 * describe synthetic asset observations on an imaginary survey network, and the
 * documents are short synthetic notes written for this demo. No client,
 * employer, or real dataset is represented here, and no field name is copied
 * from an external system.
 */

export interface SourceRecord {
  /** Stable identity of the observation in the source register. */
  recordId: string;
  /** Invented alias of the surveyed asset. */
  assetAlias: string;
  /** ISO date of the observation. */
  observedAt: string;
  /** Invented numeric reading. */
  readingValue: number;
  /** Monotonic revision of the record; bumped when the source row changes. */
  revision: number;
  /** Document that supports the observation. */
  documentId: string;
}

export interface SourceDocument {
  documentId: string;
  title: string;
  body: string;
}

/** The two records that the change simulation revises. */
export const SIMULATED_REVISED_RECORD_IDS = ['rec-003', 'rec-005'] as const;

/** The record that the change simulation adds. */
export const SIMULATED_ADDED_RECORD: SourceRecord = Object.freeze({
  recordId: 'rec-007',
  assetAlias: 'SYN-SITE-LATITUDE-09',
  observedAt: '2026-01-22',
  readingValue: 12.3,
  revision: 1,
  documentId: 'doc-004',
});

/** The document that arrives together with the added record. */
export const SIMULATED_ADDED_DOCUMENT: SourceDocument = Object.freeze({
  documentId: 'doc-004',
  title: 'Field Memo — New Station',
  body:
    'Synthetic field memo for the station added during the change simulation. The new station ' +
    'was registered with a single observation and one supporting document. An incremental pass ' +
    'inserts it as a new target row because no earlier revision of it exists in the target store. ' +
    'This text was invented for the demo.',
});

/** Values applied to the revised records by the change simulation. */
export const SIMULATED_REVISIONS: Record<string, { observedAt: string; readingValue: number }> =
  Object.freeze({
    'rec-003': { observedAt: '2026-01-20', readingValue: 13.4 },
    'rec-005': { observedAt: '2026-01-21', readingValue: 10.1 },
  });

export const SOURCE_RECORDS: readonly SourceRecord[] = Object.freeze([
  Object.freeze({
    recordId: 'rec-001',
    assetAlias: 'SYN-SITE-ORBITAL-01',
    observedAt: '2026-01-12',
    readingValue: 18.4,
    revision: 1,
    documentId: 'doc-001',
  }),
  Object.freeze({
    recordId: 'rec-002',
    assetAlias: 'SYN-SITE-ORBITAL-02',
    observedAt: '2026-01-12',
    readingValue: 21.7,
    revision: 1,
    documentId: 'doc-001',
  }),
  Object.freeze({
    recordId: 'rec-003',
    assetAlias: 'SYN-SITE-MERIDIAN-04',
    observedAt: '2026-01-13',
    readingValue: 12.9,
    revision: 1,
    documentId: 'doc-002',
  }),
  Object.freeze({
    recordId: 'rec-004',
    assetAlias: 'SYN-SITE-MERIDIAN-05',
    observedAt: '2026-01-13',
    readingValue: 15.2,
    revision: 1,
    documentId: 'doc-002',
  }),
  Object.freeze({
    recordId: 'rec-005',
    assetAlias: 'SYN-SITE-LATITUDE-07',
    observedAt: '2026-01-14',
    readingValue: 9.8,
    revision: 1,
    documentId: 'doc-003',
  }),
  Object.freeze({
    recordId: 'rec-006',
    assetAlias: 'SYN-SITE-LATITUDE-08',
    observedAt: '2026-01-14',
    readingValue: 11.6,
    revision: 1,
    documentId: 'doc-003',
  }),
]);

export const SOURCE_DOCUMENTS: readonly SourceDocument[] = Object.freeze([
  Object.freeze({
    documentId: 'doc-001',
    title: 'Calibration Note — Northern Array',
    body:
      'Synthetic note for the Pipeline Sync Lab. Instruments on the northern array were checked ' +
      'against a reference gauge at the start of every shift. Readings that drifted by more than ' +
      '0.4 units were flagged for re-measurement before the daily batch was sealed. The note is ' +
      'attached to the observations collected during the first two calibration windows and ' +
      'describes no real site.',
  }),
  Object.freeze({
    documentId: 'doc-002',
    title: 'Survey Summary — Mid Basin',
    body:
      'Synthetic survey summary used by the demo. The mid-basin survey consolidates two rounds of ' +
      'manual observations into a single pass, and every consolidated row keeps the revision ' +
      'number of the observation it was derived from. Rows whose revision did not advance are ' +
      'skipped by the incremental pass. No client or employer material is reproduced here.',
  }),
  Object.freeze({
    documentId: 'doc-003',
    title: 'Handling Note — Coastal Probe',
    body:
      'Synthetic handling note. Coastal probes are transported in a padded case and read twice at ' +
      'the start of every deployment; the second reading is the one stored in the source ' +
      'register. The note explains why a record can be revised without its observation timestamp ' +
      'moving. The text is invented for demonstration purposes only.',
  }),
]);
