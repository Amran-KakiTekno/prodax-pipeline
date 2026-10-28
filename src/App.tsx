import { useState } from 'react';
import {
  applyIncremental,
  createInitialState,
  resetDemo,
  runInitialLoad,
  selectCheckpoint,
  selectDocumentForRow,
  selectSourceSummary,
  selectTargetRows,
  selectTargetSummary,
  simulateSourceChanges,
  type SyncState,
} from './domain';

const EMPTY_COUNTS = { inserted: 0, updated: 0, skipped: 0, processed: 0 };

function OrbitMark() {
  return (
    <svg
      className="orbit-mark"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Dual Orbit mark"
      focusable="false"
    >
      <ellipse cx="32" cy="32" rx="26" ry="11" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        transform="rotate(60 32 32)"
      />
      <circle cx="32" cy="32" r="5" fill="var(--amber)" />
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<SyncState>(() => createInitialState());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const counts = state.lastResult ? state.lastResult.counts : EMPTY_COUNTS;
  const targetRows = selectTargetRows(state);
  const checkpoint = selectCheckpoint(state);
  const sourceSummary = selectSourceSummary(state);
  const targetSummary = selectTargetSummary(state);
  const selectedDocument = selectedRecordId
    ? selectDocumentForRow(state, selectedRecordId)
    : undefined;

  const handleInitialLoad = () => {
    setState((current) => runInitialLoad(current).state);
    setSelectedRecordId(null);
  };

  const handleSimulateChanges = () => {
    setState((current) => simulateSourceChanges(current));
  };

  const handleIncremental = () => {
    setState((current) => applyIncremental(current).state);
  };

  const handleReset = () => {
    setState(resetDemo());
    setSelectedRecordId(null);
  };

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead__identity">
          <OrbitMark />
          <div>
            <p className="eyebrow">Dual Orbit / Data Engineering demo</p>
            <h1>Pipeline Sync Lab</h1>
            <p className="lede">
              A technique demo for initial and incremental ingestion between two stores, with
              revision checkpoints and document linkage.
            </p>
          </div>
        </div>
        <p className="notice" role="note">
          <strong>Synthetic data.</strong> Every record, value and document on this page is
          invented for demonstration. Nothing here comes from a client, an employer or a real
          survey.
        </p>
      </header>

      <main className="lab">
        <section className="panel panel--wide" aria-labelledby="explanation-heading">
          <h2 id="explanation-heading">What this demo shows</h2>
          <p>
            The demo keeps two stores side by side. The <strong>source register</strong> holds the
            observed asset rows; the <strong>target store</strong> holds the rows that have been
            ingested. An <strong>initial load</strong> rebuilds the target store from every source
            row. An <strong>incremental sync</strong> compares the two stores on{' '}
            <code>recordId</code> + <code>revision</code>: a row that is new is inserted, a row
            whose revision advanced is updated, and a row whose revision did not move is skipped.
            Each run advances a checkpoint, so running the same sync twice changes nothing the
            second time.
          </p>
        </section>

        <section className="panel" aria-labelledby="source-heading">
          <h2 id="source-heading">Source register</h2>
          <dl className="metrics">
            <div className="metric">
              <dt>Records</dt>
              <dd data-testid="source-record-count">{sourceSummary.records}</dd>
            </div>
            <div className="metric">
              <dt>Documents</dt>
              <dd data-testid="source-document-count">{sourceSummary.documents}</dd>
            </div>
          </dl>
          <p className="panel__note">
            The source register is the side that can change. Simulating a change revises two
            existing records and adds one new record with one new document.
          </p>
        </section>

        <section className="panel" aria-labelledby="target-heading">
          <h2 id="target-heading">Target store</h2>
          <dl className="metrics">
            <div className="metric">
              <dt>Rows</dt>
              <dd data-testid="target-row-count">{targetSummary.rows}</dd>
            </div>
            <div className="metric">
              <dt>Checkpoint</dt>
              <dd data-testid="checkpoint-run">
                run {checkpoint.runNumber} / rev {checkpoint.revisionWatermark}
              </dd>
            </div>
          </dl>
          <p className="panel__note">
            The checkpoint advances on every run. The revision watermark only moves when a record
            actually carries a newer revision.
          </p>
        </section>

        <section className="panel panel--wide" aria-labelledby="controls-heading">
          <h2 id="controls-heading">Controls</h2>
          <div className="controls">
            <button type="button" className="btn btn--primary" onClick={handleInitialLoad}>
              Run initial load
            </button>
            <button type="button" className="btn" onClick={handleSimulateChanges}>
              Simulate source changes
            </button>
            <button type="button" className="btn" onClick={handleIncremental}>
              Run incremental sync
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleReset}>
              Reset demo
            </button>
          </div>
          <p className="panel__note">
            Suggested order: initial load, simulate source changes, incremental sync, then a
            second incremental sync to prove idempotency.
          </p>
        </section>

        <section className="panel panel--wide" aria-labelledby="counts-heading">
          <h2 id="counts-heading">Last run</h2>
          <div className="stat-row">
            <div className="stat stat--inserted">
              <span className="stat__label">Inserted</span>
              <span className="stat__value" data-testid="count-inserted">
                {counts.inserted}
              </span>
            </div>
            <div className="stat stat--updated">
              <span className="stat__label">Updated</span>
              <span className="stat__value" data-testid="count-updated">
                {counts.updated}
              </span>
            </div>
            <div className="stat stat--skipped">
              <span className="stat__label">Skipped</span>
              <span className="stat__value" data-testid="count-skipped">
                {counts.skipped}
              </span>
            </div>
            <div className="stat stat--mode">
              <span className="stat__label">Mode</span>
              <span className="stat__value stat__value--text" data-testid="last-run-mode">
                {state.lastResult ? state.lastResult.mode : 'no run yet'}
              </span>
            </div>
          </div>
        </section>

        <section className="panel panel--table" aria-labelledby="rows-heading">
          <h2 id="rows-heading">Rows in the target store</h2>
          {targetRows.length === 0 ? (
            <p className="empty" data-testid="target-empty">
              The target store is empty. Run the initial load to ingest the source register.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="target-table">
                <caption className="sr-only">
                  Rows currently held in the target store, newest revision first as stored.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Asset</th>
                    <th scope="col">Observed</th>
                    <th scope="col">Reading</th>
                    <th scope="col">Rev</th>
                    <th scope="col">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {targetRows.map((row) => {
                    const isSelected = row.recordId === selectedRecordId;
                    return (
                      <tr
                        key={row.recordId}
                        className={isSelected ? 'is-selected' : undefined}
                        data-testid={`target-row-${row.recordId}`}
                        onClick={() => setSelectedRecordId(row.recordId)}
                      >
                        <td data-label="Record">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`Inspect ${row.recordId}`}
                            aria-pressed={isSelected}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedRecordId(row.recordId);
                            }}
                          >
                            {row.recordId}
                          </button>
                        </td>
                        <td data-label="Asset">{row.assetAlias}</td>
                        <td data-label="Observed">{row.observedAt}</td>
                        <td data-label="Reading">{row.readingValue.toFixed(1)}</td>
                        <td data-label="Rev">{row.revision}</td>
                        <td data-label="Document">{row.documentId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="panel__note">
            Select any row to open the synthetic document that supports it.
          </p>
        </section>

        <section className="panel panel--document" aria-labelledby="document-heading">
          <h2 id="document-heading">Linked document</h2>
          <div aria-live="polite" data-testid="document-panel">
            {selectedDocument ? (
              <article className="document">
                <h3 data-testid="document-title">{selectedDocument.title}</h3>
                <p className="document__meta">
                  <span className="tag" data-testid="document-id">
                    {selectedDocument.documentId}
                  </span>
                  <span className="document__linked">
                    linked to <strong>{selectedRecordId}</strong>
                  </span>
                </p>
                <p className="document__body" data-testid="document-body">
                  {selectedDocument.body}
                </p>
              </article>
            ) : (
              <p className="empty" data-testid="document-empty">
                No row selected yet. Choose a row in the target store to read the synthetic document
                attached to it.
              </p>
            )}
          </div>
        </section>

        <section className="panel panel--wide" aria-labelledby="log-heading">
          <h2 id="log-heading">Execution log</h2>
          {state.log.length === 0 ? (
            <p className="empty" data-testid="log-empty">
              The log is empty. No sync has run since the demo was reset.
            </p>
          ) : (
            <ol className="log" data-testid="execution-log">
              {state.log.map((entry) => (
                <li key={entry.sequence} className={`log__entry log__entry--${entry.mode}`}>
                  <span className="log__index">{entry.sequence}</span>
                  <span className="log__mode">{entry.mode}</span>
                  <span className="log__message">{entry.message}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="colophon">
        <p>
          Clean-room technique demo by Dual Orbit. Synthetic fixtures only - no client, employer or
          personal data is present, and the demo is not a production pipeline.
        </p>
      </footer>
    </div>
  );
}
