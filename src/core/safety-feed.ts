import { randomUUID } from 'node:crypto';
import type { SafetySignal } from '../types.js';
import { sha256 } from './canonical.js';

export interface FeedRecord {
  chain: string;
  subject: string;
  status: 'confirmed' | 'cleared';
  severity: SafetySignal['severity'];
  category: string;
  evidence: string[];
  updatedAt: string;
}

export interface PendingReport {
  id: string;
  fingerprint: string;
  status: 'pending-review';
  submittedAt: string;
}

export class SafetyFeed {
  private readonly records = new Map<string, FeedRecord>();
  private readonly reports = new Map<string, PendingReport>();

  lookup(chain: string, subject: string): FeedRecord | { chain: string; subject: string; status: 'unknown' } {
    return this.records.get(this.key(chain, subject)) ?? { chain, subject, status: 'unknown' };
  }

  submit(input: Record<string, unknown>): PendingReport {
    const submittedAt = new Date().toISOString();
    const report = {
      id: `report_${randomUUID()}`,
      fingerprint: sha256(input),
      status: 'pending-review' as const,
      submittedAt,
    };
    this.reports.set(report.id, report);
    return report;
  }

  stats() {
    return { confirmedRecords: this.records.size, pendingReports: this.reports.size };
  }

  private key(chain: string, subject: string): string {
    return `${chain.trim().toLowerCase()}:${subject.trim().toLowerCase()}`;
  }
}
