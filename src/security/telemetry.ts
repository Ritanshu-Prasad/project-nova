/**
 * Project Nova Security Telemetry & Audit Logger
 * Tracks threat detections, canary triggers, and token efficiency metrics.
 * Decoupled from UI components.
 */

import type { SecurityAuditEntry, SecurityMetrics } from './types';

const auditLog: SecurityAuditEntry[] = [];

let metrics: SecurityMetrics = {
  totalAuditedRequests: 0,
  threatsDetected: 0,
  canaryTamperAttempts: 0,
  evaluationsClamped: 0,
  totalTokensSaved: 0,
};

/**
 * Records an audit entry for an evaluated prompt transmission.
 */
export function recordSecurityAudit(
  entry: Omit<SecurityAuditEntry, 'id' | 'timestamp'>
): SecurityAuditEntry {
  const fullEntry: SecurityAuditEntry = {
    ...entry,
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  auditLog.unshift(fullEntry);
  if (auditLog.length > 100) {
    auditLog.pop();
  }

  // Update cumulative metrics
  metrics.totalAuditedRequests += 1;
  if (entry.threatLevel !== 'none') {
    metrics.threatsDetected += 1;
  }

  return fullEntry;
}

/**
 * Records canary honeytoken extraction attempts.
 */
export function recordCanaryViolation(): void {
  metrics.canaryTamperAttempts += 1;
}

/**
 * Records score clamping incidents.
 */
export function recordClampingIncident(): void {
  metrics.evaluationsClamped += 1;
}

/**
 * Records token savings from optimization and compression.
 */
export function recordTokensSaved(count: number): void {
  if (count > 0) {
    metrics.totalTokensSaved += count;
  }
}

/**
 * Retrieves the current security audit entries.
 */
export function getSecurityAuditLogs(): readonly SecurityAuditEntry[] {
  return auditLog;
}

/**
 * Retrieves cumulative security and optimization metrics.
 */
export function getSecurityMetrics(): Readonly<SecurityMetrics> {
  return { ...metrics };
}

/**
 * Resets telemetry (useful for unit tests and clean session starts).
 */
export function resetTelemetry(): void {
  auditLog.length = 0;
  metrics = {
    totalAuditedRequests: 0,
    threatsDetected: 0,
    canaryTamperAttempts: 0,
    evaluationsClamped: 0,
    totalTokensSaved: 0,
  };
}
