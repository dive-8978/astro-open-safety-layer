import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'must be a non-negative decimal string');
const hexData = z.string().regex(/^0x([0-9a-fA-F]{2})*$/, 'must be even-length hex data');

export const intentEnvelopeSchema = z.object({
  version: z.literal('aoi.intent/0.1'),
  id: z.string().min(1).max(160).optional(),
  actor: z.object({
    id: z.string().min(1).max(256),
    type: z.enum(['human', 'agent', 'service']),
  }).strict(),
  actions: z.array(z.object({
    kind: z.enum(['call', 'transfer', 'approve', 'swap', 'bridge', 'custom']),
    chain: z.string().min(1).max(80),
    from: z.string().min(1).max(256).optional(),
    to: z.string().min(1).max(256).optional(),
    value: decimalString.optional(),
    data: hexData.optional(),
    asset: z.string().min(1).max(256).optional(),
  }).strict()).min(1).max(32),
  constraints: z.object({
    deadline: z.string().datetime().optional(),
    maxTotalValue: decimalString.optional(),
    requireSimulation: z.boolean().optional(),
    requireHumanApprovalAbove: decimalString.optional(),
  }).strict().optional(),
  nonce: z.string().min(1).max(256),
  issuedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export const simulateRequestSchema = z.object({
  intent: intentEnvelopeSchema,
  liveRpc: z.boolean().default(false),
}).strict();

export const safetyReportSchema = z.object({
  chain: z.string().min(1).max(80),
  subject: z.string().min(1).max(256),
  category: z.enum(['malicious-address', 'phishing-domain', 'risky-contract', 'false-positive', 'other']),
  evidenceUrl: z.string().url(),
  summary: z.string().min(20).max(2000),
  reporter: z.string().min(1).max(256),
}).strict();

export const routeRequestSchema = z.object({
  intent: intentEnvelopeSchema,
  candidates: z.array(z.object({
    id: z.string().min(1).max(128),
    provider: z.string().min(1).max(128),
    feeUsd: z.number().finite().nonnegative(),
    estimatedSeconds: z.number().int().positive().max(604800),
    risk: z.enum(['low', 'medium', 'high']),
    chains: z.array(z.string().min(1).max(80)).min(1),
    metadata: z.record(z.unknown()).optional(),
  }).strict()).min(1).max(100),
  weights: z.object({
    fee: z.number().min(0).max(1).default(0.45),
    speed: z.number().min(0).max(1).default(0.25),
    safety: z.number().min(0).max(1).default(0.30),
  }).strict().default({ fee: 0.45, speed: 0.25, safety: 0.30 }),
}).strict();

export type IntentEnvelopeInput = z.infer<typeof intentEnvelopeSchema>;
