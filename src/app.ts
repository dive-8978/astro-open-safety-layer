import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import { canonicalJson, sha256 } from './core/canonical.js';
import { fingerprintIntent } from './core/fingerprint.js';
import { ReceiptSigner } from './core/receipt-signer.js';
import { assess } from './core/risk-engine.js';
import { rankRoutes } from './core/route-planner.js';
import { SafetyFeed } from './core/safety-feed.js';
import { Simulator } from './core/simulator.js';
import { rateLimit } from './http/rate-limit.js';
import { openApiDocument } from './openapi.js';
import { intentEnvelopeSchema, routeRequestSchema, safetyReportSchema, simulateRequestSchema } from './schemas.js';
import type { SafetyAssessment, SignedSafetyReceipt, SimulationResult } from './types.js';

export function createApp(config: AppConfig) {
  const app = express();
  const simulator = new Simulator(config.rpcUrls);
  const signer = new ReceiptSigner(config.signingPrivateKeyBase64);
  const safetyFeed = new SafetyFeed();
  const simulations = new Map<string, SimulationResult>();
  const assessments = new Map<string, SafetyAssessment>();
  const receipts = new Map<string, SignedSafetyReceipt>();

  app.disable('x-powered-by');
  app.use(cors({
    origin: config.corsOrigins === '*'
      ? '*'
      : (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin)),
  }));
  app.use(express.json({ limit: config.maxRequestBytes }));
  app.use(rateLimit(config.rateLimitPerMinute));
  app.use((request, response, next) => {
    const requestId = request.header('x-request-id') || randomUUID();
    response.setHeader('x-request-id', requestId);
    response.setHeader('cache-control', 'no-store');
    next();
  });

  app.get('/health', (_request, response) => response.json({
    status: 'ok',
    service: 'Astro Open Safety Layer',
    version: '0.1.0',
    custody: false,
    signingKey: { keyId: signer.keyId, ephemeral: signer.ephemeral },
    rpcChains: [...config.rpcUrls.keys()],
    feed: safetyFeed.stats(),
  }));

  app.get('/.well-known/astro-safety', (_request, response) => response.json({
    protocol: 'Astro Open Safety Layer',
    version: '0.1.0',
    intentSchema: 'aoi.intent/0.1',
    receiptSchema: 'aoi.receipt/0.1',
    openapi: '/openapi.json',
    publicKey: '/v1/keys/current',
    guarantees: ['no-private-key-input', 'no-custody', 'deterministic-static-analysis', 'signed-receipts'],
    limitations: ['static checks are not a security guarantee', 'RPC simulation depends on configured chain state'],
  }));

  app.get('/openapi.json', (_request, response) => response.json(openApiDocument));
  app.get('/v1/status', (_request, response) => response.json({
    service: 'online',
    protocolVersion: '0.1.0',
    simulations: simulations.size,
    assessments: assessments.size,
    receipts: receipts.size,
    safetyFeed: safetyFeed.stats(),
  }));

  app.post('/v1/intents/fingerprint', (request, response) => {
    const intent = intentEnvelopeSchema.parse(request.body);
    response.json({ fingerprint: fingerprintIntent(intent), canonical: canonicalJson(intent), valid: true });
  });

  app.post('/v1/simulate', async (request, response, next) => {
    try {
      const input = simulateRequestSchema.parse(request.body);
      const simulation = await simulator.simulate(input.intent, input.liveRpc);
      simulations.set(simulation.id, simulation);
      response.json(simulation);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/check', async (request, response, next) => {
    try {
      const input = simulateRequestSchema.parse(request.body);
      const simulation = await simulator.simulate(input.intent, input.liveRpc);
      const assessment = assess(input.intent, simulation);
      simulations.set(simulation.id, simulation);
      assessments.set(assessment.id, assessment);
      response.json({ assessment, simulation });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/route', (request, response) => {
    const input = routeRequestSchema.parse(request.body);
    response.json({
      intentFingerprint: fingerprintIntent(input.intent),
      rankedAt: new Date().toISOString(),
      executionPerformed: false,
      routes: rankRoutes(input.candidates, input.weights),
    });
  });

  app.post('/v1/receipts', (request, response) => {
    const simulationId = String(request.body?.simulationId || '');
    const assessmentId = String(request.body?.assessmentId || '');
    const simulation = simulations.get(simulationId) ?? request.body?.simulation as SimulationResult | undefined;
    const assessment = assessments.get(assessmentId) ?? request.body?.assessment as SafetyAssessment | undefined;
    if (!simulation || !assessment || assessment.simulationId !== simulation.id) {
      return response.status(404).json({ error: 'matching_simulation_and_assessment_required' });
    }
    if (simulation.intentFingerprint !== assessment.intentFingerprint) {
      return response.status(400).json({ error: 'intent_fingerprint_mismatch' });
    }
    const receipt = signer.issue(simulation, assessment);
    receipts.set(receipt.id, receipt);
    response.status(201).json(receipt);
  });

  app.get('/v1/receipts/:id', (request, response) => {
    const receipt = receipts.get(request.params.id);
    if (!receipt) return response.status(404).json({ error: 'receipt_not_found' });
    response.json(receipt);
  });

  app.post('/v1/receipts/verify', (request, response) => {
    const receipt = request.body as SignedSafetyReceipt;
    const knownKey = receipt?.keyId === signer.keyId;
    const valid = knownKey && signer.verify(receipt);
    response.status(valid ? 200 : 400).json({ valid, knownKey, receiptHash: sha256(receipt) });
  });

  app.get('/v1/keys/current', (_request, response) => response.json(signer.publicDescriptor()));

  app.get('/v1/safety/:chain/:subject', (request, response) => {
    response.json(safetyFeed.lookup(request.params.chain, request.params.subject));
  });

  app.post('/v1/safety/reports', (request, response) => {
    const report = safetyReportSchema.parse(request.body);
    response.status(202).json(safetyFeed.submit(report));
  });

  app.use((_request, response) => response.status(404).json({ error: 'not_found' }));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      return response.status(400).json({ error: 'invalid_request', issues: error.issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ error: 'internal_error', message });
  };
  app.use(errorHandler);
  return app;
}
