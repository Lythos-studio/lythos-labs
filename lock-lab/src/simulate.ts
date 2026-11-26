/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Analysis, Step, WorkKind } from "./analyze";
import { ACCESS_SHARE, ROW_EXCLUSIVE, SHARE, conflicts, CONFLICT_MASK, type Mode } from "./locks";

/**
 * Rows per second for each kind of work. Rough figures for a modest server with the table in memory;
 * real numbers depend on row width, indexes, disks and load. Shown on the page as an estimate.
 */
export const SPEED: Record<WorkKind, number> = { scan: 3_000_000, validate: 1_000_000, index: 750_000, rewrite: 300_000, backfill: 80_000 };
/** A statement that only changes the catalog still takes a moment. */
export const INSTANT_MS = 2;
export const DEFAULT_ROWS = 2_000_000;

export type Traffic = {
  /** Plain reads per second on each table (ACCESS SHARE). */
  readsPerSec: number;
  /** Inserts, updates and deletes per second on each table (ROW EXCLUSIVE). */
  writesPerSec: number;
  /** How long one application query holds its lock. */
  queryMs: number;
  /** A long read on the first table that is already running when the migration starts; 0 for none. */
  slowMs: number;
  /** The application gives up on a query after waiting this long; 0 waits forever. */
  appTimeoutMs: number;
  /** Rows per table; tables not listed get DEFAULT_ROWS. */
  rows: Record<string, number>;
};

export const DEFAULT_TRAFFIC: Traffic = { readsPerSec: 200, writesPerSec: 40, queryMs: 4, slowMs: 15_000, appTimeoutMs: 10_000, rows: {} };

export type SimOptions = {
  traffic: Traffic;
  /** Run the migration again after a lock or statement timeout, like a careful runner does. */
  retry?: { attempts: number; delayMs: number };
  /** Simulated moment the migration starts. */
  startMs?: number;
  seed?: number;
  /** Simulation stops here even when the migration is still running. */
  maxMs?: number;
  /** About this many dots per second per lane are kept for drawing; each dot then stands for several requests. */
  dotsPerSec?: number;
};

export type Dot = { a: number; s: number; write: boolean; failed: boolean };
export type LockInterval = { table: string; step: number; mode: Mode; rows: boolean; from: number; granted: number | null; to: number };
export type Attempt = { step: number; from: number; granted: number | null; to: number; outcome: "done" | "lock-timeout" | "statement-timeout" | "cut" };
export type Lane = {
  table: string;
  rows: number;
  /** A sample of the requests, sorted by arrival. */
  dots: Dot[];
  perDot: number;
  /** Requests waiting at each bucket boundary. */
  waiting: Int32Array;
  maxWaiting: number;
  requests: number;
  delayed: number;
  timedOut: number;
  maxWaitMs: number;
  /** Time during which at least one request on this table was waiting. */
  stalledMs: number;
};
export type SimResult = {
  endMs: number;
  bucketMs: number;
  startMs: number;
  lanes: Lane[];
  locks: LockInterval[];
  attempts: Attempt[];
  slow: { table: string; from: number; to: number } | null;
  outcome: "done" | "failed" | "cut";
  finishedAt: number | null;
  totals: { requests: number; delayed: number; timedOut: number; maxWaitMs: number; stalledMs: number };
};

/** How long a step works once it holds its locks. */
export function workMs(step: Step, rowsOf: (table: string) => number): number {
  let ms = INSTANT_MS;
  for (const w of step.works) ms += (rowsOf(w.table) / SPEED[w.kind]) * 1000;
  // CREATE INDEX CONCURRENTLY and REINDEX CONCURRENTLY scan the table twice.
  return step.concurrent ? INSTANT_MS + (ms - INSTANT_MS) * 2 : ms;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Req = {
  table: number;
  mode: Mode;
  /** 0 read, 1 write, 2 slow read, 3 migration. */
  who: 0 | 1 | 2 | 3;
  arrive: number;
  start: number;
  granted: boolean;
  gone: boolean;
  dot: Dot | null;
  interval: LockInterval | null;
  /** Lane and position in that lane's log, for application requests; -1 otherwise. */
  lane: number;
  log: number;
};

type Ev = { t: number; seq: number; type: "arrive" | "release" | "cancel" | "mig" | "mig-timeout"; lane?: number; req?: Req; run?: () => void };

class Heap {
  private a: Ev[] = [];
  get size() {
    return this.a.length;
  }
  push(e: Ev) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): Ev | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
const less = (x: Ev, y: Ev) => x.t < y.t || (x.t === y.t && x.seq < y.seq);

type LockState = { held: Int32Array; queue: Req[]; head: number; waiting: Int32Array; mine: Int32Array };

/**
 * Plays the migration against steady application traffic with the Postgres lock queue rules:
 * a request waits when it conflicts with a granted lock or with a request already waiting ahead of it.
 * That second rule is why one ALTER TABLE waiting behind a slow query stops every query after it.
 */
export function simulate(analysis: Analysis, options: SimOptions): SimResult {
  const traffic = options.traffic;
  const startMs = options.startMs ?? 3000;
  const maxMs = options.maxMs ?? 300_000;
  const bucketMs = 100;
  const tailMs = 4000;
  const random = rng(options.seed ?? 7);
  const heap = new Heap();
  let seq = 0;
  const at = (t: number, e: Omit<Ev, "t" | "seq">) => heap.push({ ...e, t, seq: seq++ });

  // Every table the file touches gets a lock state; existing ones also get traffic (a lane), at most six.
  const names = [...new Set([...analysis.tables, ...analysis.steps.flatMap((s) => s.locks.map((l) => l.table))])];
  const index = new Map(names.map((n, i) => [n, i]));
  const locks: LockState[] = names.map(() => ({ held: new Int32Array(8), queue: [], head: 0, waiting: new Int32Array(8), mine: new Int32Array(8) }));
  const laneTables = analysis.tables.slice(0, 6);
  const rowsOf = (t: string) => traffic.rows[t] ?? DEFAULT_ROWS;
  const rate = Math.max(0, traffic.readsPerSec) + Math.max(0, traffic.writesPerSec);
  const writeShare = rate ? Math.max(0, traffic.writesPerSec) / rate : 0;
  const perDot = Math.max(1, Math.round(rate / (options.dotsPerSec ?? 40)));

  type AppLog = { arrive: number[]; start: number[]; failed: number };
  const logs: AppLog[] = laneTables.map(() => ({ arrive: [], start: [], failed: 0 }));
  const dots: Dot[][] = laneTables.map(() => []);
  const counters = laneTables.map(() => 0);
  const intervals: LockInterval[] = [];
  const attempts: Attempt[] = [];

  let stopArrivals = maxMs;
  let finishedAt: number | null = null;
  let outcome: SimResult["outcome"] = "cut";

  const fits = (ls: LockState, r: Req, againstQueue: boolean) => {
    for (let m = 0; m < 8; m++) {
      const others = ls.held[m] - (r.who === 3 ? ls.mine[m] : 0);
      if (others > 0 && conflicts(r.mode, m as Mode)) return false;
      if (againstQueue && ls.waiting[m] > 0 && conflicts(r.mode, m as Mode)) return false;
    }
    return true;
  };

  const grant = (r: Req, t: number) => {
    const ls = locks[r.table];
    r.granted = true;
    r.start = t;
    ls.held[r.mode]++;
    if (r.who === 3) {
      ls.mine[r.mode]++;
      if (r.interval) r.interval.granted = t;
      migration.granted(t);
    } else if (r.who === 2) at(t + traffic.slowMs, { type: "release", req: r });
    else {
      at(t + traffic.queryMs, { type: "release", req: r });
      logs[r.lane].start[r.log] = t;
      if (r.dot) r.dot.s = t;
    }
  };

  const wake = (tableIdx: number, t: number) => {
    const ls = locks[tableIdx];
    let ahead = 0;
    for (let i = ls.head; i < ls.queue.length; i++) {
      const r = ls.queue[i];
      if (r.granted || r.gone) continue;
      if (fits(ls, r, false) && (CONFLICT_MASK[r.mode] & ahead) === 0) {
        ls.waiting[r.mode]--;
        grant(r, t);
      } else {
        ahead |= 1 << r.mode;
        // Everything conflicts with ACCESS EXCLUSIVE, so nobody behind it can go first.
        if (ahead & (1 << 7)) break;
      }
    }
    while (ls.head < ls.queue.length && (ls.queue[ls.head].granted || ls.queue[ls.head].gone)) ls.head++;
    if (ls.head > 4096) {
      ls.queue = ls.queue.slice(ls.head);
      ls.head = 0;
    }
  };

  /** Returns true when granted at once. */
  const request = (r: Req, t: number) => {
    const ls = locks[r.table];
    // A transaction that already holds a lock on the table does not queue behind requests that wait for it.
    const own = r.who === 3 && ls.mine.some((n) => n > 0);
    if (fits(ls, r, !own)) {
      grant(r, t);
      return true;
    }
    ls.queue.push(r);
    ls.waiting[r.mode]++;
    return false;
  };

  const release = (r: Req, t: number) => {
    const ls = locks[r.table];
    ls.held[r.mode]--;
    if (r.who === 3) ls.mine[r.mode]--;
    wake(r.table, t);
  };

  const withdraw = (r: Req, t: number) => {
    if (r.granted || r.gone) return;
    r.gone = true;
    locks[r.table].waiting[r.mode]--;
    wake(r.table, t);
  };

  // The migration: one statement after another, holding locks until its transaction ends.
  const migration = (() => {
    const steps = analysis.steps;
    let i = 0;
    let txStart = 0;
    let lockTimeout = 0;
    let statementTimeout = 0;
    let retries = options.retry?.attempts ?? 0;
    let held: Req[] = [];
    let pending: { table: string; mode: Mode; rows: boolean }[] = [];
    let waitingReq: Req | null = null;
    let attempt: Attempt | null = null;
    let token = 0;

    const releaseAll = (t: number) => {
      const list = held;
      held = [];
      for (const r of list) {
        if (r.interval) r.interval.to = t;
        if (r.granted) release(r, t);
        else withdraw(r, t);
      }
    };
    const finish = (t: number, how: SimResult["outcome"]) => {
      releaseAll(t);
      finishedAt = how === "done" ? t : null;
      outcome = how;
      stopArrivals = Math.min(maxMs, Math.max(t + tailMs, startMs + 12_000));
    };

    const advance = (t: number) => {
      for (;;) {
        if (i >= steps.length) return finish(t, "done");
        const s = steps[i];
        if (s.kind === "begin") {
          txStart = i++;
          continue;
        }
        if (s.kind === "commit" || s.kind === "rollback") {
          releaseAll(t);
          i++;
          continue;
        }
        if (s.set) {
          if (s.set.name === "lock_timeout") lockTimeout = s.set.ms;
          else statementTimeout = s.set.ms;
          i++;
          continue;
        }
        if (s.tx === null) txStart = i;
        if (!s.locks.length && !s.works.length) {
          i++;
          continue;
        }
        attempt = { step: i, from: t, granted: null, to: t, outcome: "done" };
        attempts.push(attempt);
        pending = s.locks.map((l) => ({ table: l.table, mode: (l.rows ? SHARE : l.mode) as Mode, rows: !!l.rows }));
        return next(t);
      }
    };

    const next = (t: number) => {
      const s = steps[i];
      while (pending.length) {
        const l = pending.shift()!;
        const tableIdx = index.get(l.table)!;
        const r: Req = { table: tableIdx, mode: l.mode, who: 3, arrive: t, start: t, granted: false, gone: false, dot: null, interval: null, lane: -1, log: -1 };
        r.interval = { table: l.table, step: i, mode: l.mode, rows: l.rows, from: t, granted: null, to: Infinity };
        intervals.push(r.interval);
        held.push(r);
        if (!request(r, t)) {
          waitingReq = r;
          const limit = [lockTimeout, statementTimeout ? statementTimeout - (t - attempt!.from) : 0].filter((x) => x > 0);
          if (limit.length) {
            const mine = ++token;
            const why = lockTimeout && lockTimeout === Math.min(...limit) ? "lock-timeout" : "statement-timeout";
            at(t + Math.min(...limit), { type: "mig-timeout", run: () => mine === token && waitingReq === r && fail(t + Math.min(...limit), why) });
          }
          return;
        }
      }
      // All locks held: do the work.
      attempt!.granted = t;
      let doneAt = t + workMs(s, rowsOf);
      if (s.concurrent && slow && slow.to > t && slow.from < attempt!.from) doneAt = slow.to + workMs(s, rowsOf);
      const mine = ++token;
      if (statementTimeout && doneAt - attempt!.from > statementTimeout) {
        at(attempt!.from + statementTimeout, { type: "mig", run: () => mine === token && fail(attempt!.from + statementTimeout, "statement-timeout") });
      } else
        at(doneAt, {
          type: "mig",
          run: () => {
            if (mine !== token) return;
            attempt!.to = doneAt;
            if (s.tx === null) releaseAll(doneAt);
            i++;
            advance(doneAt);
          },
        });
    };

    const fail = (t: number, why: "lock-timeout" | "statement-timeout") => {
      token++;
      if (waitingReq) withdraw(waitingReq, t);
      waitingReq = null;
      attempt!.outcome = why;
      attempt!.to = t;
      // Postgres rolls back the whole transaction, so every lock it took is released.
      for (const r of held) if (r.interval && !r.granted) r.interval.to = t;
      releaseAll(t);
      if (retries > 0) {
        retries--;
        i = txStart;
        const resume = t + (options.retry?.delayMs ?? 5000);
        at(resume, { type: "mig", run: () => advance(resume) });
      } else finish(t, "failed");
    };

    return {
      start: (t: number) => advance(t),
      granted: (t: number) => {
        waitingReq = null;
        token++;
        next(t);
      },
      cut: (t: number) => {
        if (attempt && outcome === "cut") {
          attempt.outcome = "cut";
          attempt.to = t;
        }
        for (const r of held) if (r.interval && r.interval.to === Infinity) r.interval.to = t;
      },
    };
  })();

  // A slow read that is already running when the migration starts, the classic trigger of a lock queue.
  const slowTable = laneTables[0];
  const slow = traffic.slowMs > 0 && slowTable ? { table: slowTable, from: Math.min(500, startMs), to: Math.min(500, startMs) + traffic.slowMs } : null;
  if (slow) at(slow.from, { type: "arrive", req: { table: index.get(slow.table)!, mode: ACCESS_SHARE, who: 2, arrive: slow.from, start: slow.from, granted: false, gone: false, dot: null, interval: null, lane: -1, log: -1 } });

  const gap = () => (rate > 0 ? (-Math.log(1 - random()) / rate) * 1000 : Infinity);
  laneTables.forEach((_, lane) => at(gap(), { type: "arrive", lane }));
  at(startMs, { type: "mig", run: () => migration.start(startMs) });

  let now = 0;
  let guard = 0;
  while (heap.size && guard++ < 5_000_000) {
    const e = heap.pop()!;
    if (e.t > maxMs) break;
    now = e.t;
    if (e.type === "mig" || e.type === "mig-timeout") e.run!();
    else if (e.type === "release") release(e.req!, now);
    else if (e.type === "cancel") {
      const r = e.req!;
      if (!r.granted && !r.gone) {
        withdraw(r, now);
        logs[r.lane].failed++;
        logs[r.lane].start[r.log] = now;
        if (r.dot) {
          r.dot.s = now;
          r.dot.failed = true;
        }
      }
    } else if (e.req) request(e.req, now);
    else if (e.lane !== undefined) {
      if (now >= stopArrivals) continue;
      const lane = e.lane;
      const write = random() < writeShare;
      const r: Req = { table: index.get(laneTables[lane])!, mode: write ? ROW_EXCLUSIVE : ACCESS_SHARE, who: write ? 1 : 0, arrive: now, start: now, granted: false, gone: false, dot: null, interval: null, lane, log: logs[lane].arrive.length };
      logs[lane].arrive.push(now);
      logs[lane].start.push(Infinity);
      if (counters[lane]++ % perDot === 0) {
        r.dot = { a: now, s: Infinity, write, failed: false };
        dots[lane].push(r.dot);
      }
      if (!request(r, now) && traffic.appTimeoutMs > 0) at(now + traffic.appTimeoutMs, { type: "cancel", req: r });
      at(now + gap(), { type: "arrive", lane });
    }
  }
  const endMs = Math.min(maxMs, Math.max(stopArrivals, now));
  if (outcome === "cut") migration.cut(endMs);
  for (const iv of intervals) if (iv.to === Infinity) iv.to = endMs;

  const lanes: Lane[] = laneTables.map((table, lane) => {
    const log = logs[lane];
    const n = log.arrive.length;
    const buckets = Math.ceil(endMs / bucketMs) + 1;
    const diff = new Int32Array(buckets + 1);
    let delayed = 0;
    let maxWaitMs = 0;
    for (let k = 0; k < n; k++) {
      const a = log.arrive[k];
      const s = Math.min(log.start[k], endMs);
      const wait = s - a;
      if (wait >= 1000) delayed++;
      if (wait > maxWaitMs) maxWaitMs = wait;
      const from = Math.ceil(a / bucketMs);
      const to = Math.ceil(s / bucketMs);
      if (to > from) {
        diff[from]++;
        diff[Math.min(to, buckets)]--;
      }
    }
    const waiting = new Int32Array(buckets);
    let run = 0;
    let maxWaiting = 0;
    let stalled = 0;
    for (let b = 0; b < buckets; b++) {
      run += diff[b];
      waiting[b] = run;
      if (run > maxWaiting) maxWaiting = run;
      if (run > 0) stalled++;
    }
    return { table, rows: rowsOf(table), dots: dots[lane], perDot, waiting, maxWaiting, requests: n, delayed, timedOut: log.failed, maxWaitMs, stalledMs: stalled * bucketMs };
  });

  return {
    endMs,
    bucketMs,
    startMs,
    lanes,
    locks: intervals,
    attempts,
    slow,
    outcome,
    finishedAt,
    totals: {
      requests: lanes.reduce((s, l) => s + l.requests, 0),
      delayed: lanes.reduce((s, l) => s + l.delayed, 0),
      timedOut: lanes.reduce((s, l) => s + l.timedOut, 0),
      maxWaitMs: Math.max(0, ...lanes.map((l) => l.maxWaitMs)),
      stalledMs: Math.max(0, ...lanes.map((l) => l.stalledMs)),
    },
  };
}
