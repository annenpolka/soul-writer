import type { PipelineStage } from '../types.js';

/**
 * Creates a pipeline stage that collects anti-patterns from failed corrections.
 * Should be placed after the correction stage.
 * If correction was attempted but failed (complianceResult still non-compliant after correction),
 * it collects anti-patterns from the violations.
 */
export function createAntiSoulCollectionStage(): PipelineStage {
  return async (ctx) => {
    // Only collect if correction was attempted and compliance still failing
    if (!ctx.complianceResult || ctx.complianceResult.isCompliant || ctx.correctionAttempts === 0) {
      return ctx;
    }

    const { createAntiSoulCollector } = await import('../../learning/anti-soul-collector.js');
    const collector = createAntiSoulCollector(ctx.deps.soulText.antiSoul);

    // Build a minimal CorrectionLoopResult for the collector
    const correctionResult = {
      success: false,
      finalText: ctx.text,
      attempts: ctx.correctionAttempts,
      totalTokensUsed: 0,
      originalViolations: ctx.complianceResult.violations,
    };

    collector.collectFromFailedCorrection(correctionResult);

    return ctx;
  };
}
