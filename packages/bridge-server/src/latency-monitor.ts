import { Logger } from './logger';

interface LatencyMetrics {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  over100ms: number; // Count of messages that exceeded 100ms
}

interface LatencyStats {
  overall: LatencyMetrics;
  byType: Map<string, LatencyMetrics>;
  lastReportTime: number;
}

export class LatencyMonitor {
  private logger: Logger;
  private stats: LatencyStats;
  private reportInterval: number;
  private reportTimer?: NodeJS.Timeout;
  private latencyThreshold: number = 100; // 100ms threshold per requirements

  constructor(logger: Logger, reportIntervalMs: number = 60000) {
    this.logger = logger;
    this.reportInterval = reportIntervalMs;
    this.stats = {
      overall: this.createEmptyMetrics(),
      byType: new Map(),
      lastReportTime: Date.now()
    };
  }

  private createEmptyMetrics(): LatencyMetrics {
    return {
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      avgMs: 0,
      over100ms: 0
    };
  }

  /**
   * Record a message forwarding latency
   */
  recordLatency(messageType: string, latencyMs: number): void {
    // Update overall metrics
    this.updateMetrics(this.stats.overall, latencyMs);

    // Update per-type metrics
    if (!this.stats.byType.has(messageType)) {
      this.stats.byType.set(messageType, this.createEmptyMetrics());
    }
    const typeMetrics = this.stats.byType.get(messageType)!;
    this.updateMetrics(typeMetrics, latencyMs);

    // Log warning if latency exceeds threshold
    if (latencyMs > this.latencyThreshold) {
      this.logger.warn('Message forwarding exceeded latency threshold', {
        messageType,
        latencyMs,
        thresholdMs: this.latencyThreshold
      });
    }
  }

  private updateMetrics(metrics: LatencyMetrics, latencyMs: number): void {
    metrics.count++;
    metrics.totalMs += latencyMs;
    metrics.minMs = Math.min(metrics.minMs, latencyMs);
    metrics.maxMs = Math.max(metrics.maxMs, latencyMs);
    metrics.avgMs = metrics.totalMs / metrics.count;
    
    if (latencyMs > this.latencyThreshold) {
      metrics.over100ms++;
    }
  }

  /**
   * Start periodic reporting of latency statistics
   */
  startReporting(): void {
    this.reportTimer = setInterval(() => {
      this.reportStats();
    }, this.reportInterval);
  }

  /**
   * Stop periodic reporting
   */
  stopReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }
  }

  /**
   * Generate and log latency statistics report
   */
  reportStats(): void {
    const now = Date.now();
    const timeSinceLastReport = now - this.stats.lastReportTime;

    if (this.stats.overall.count === 0) {
      this.logger.debug('No messages forwarded since last report');
      return;
    }

    // Log overall statistics
    this.logger.info('Latency statistics report', {
      reportPeriodMs: timeSinceLastReport,
      overall: {
        messagesForwarded: this.stats.overall.count,
        avgLatencyMs: Math.round(this.stats.overall.avgMs * 100) / 100,
        minLatencyMs: this.stats.overall.minMs,
        maxLatencyMs: this.stats.overall.maxMs,
        over100ms: this.stats.overall.over100ms,
        percentOver100ms: Math.round((this.stats.overall.over100ms / this.stats.overall.count) * 10000) / 100
      }
    });

    // Log per-type statistics
    const typeStats: Record<string, any> = {};
    this.stats.byType.forEach((metrics, type) => {
      typeStats[type] = {
        count: metrics.count,
        avgMs: Math.round(metrics.avgMs * 100) / 100,
        maxMs: metrics.maxMs,
        over100ms: metrics.over100ms
      };
    });

    if (Object.keys(typeStats).length > 0) {
      this.logger.info('Latency by message type', typeStats);
    }

    // Reset statistics for next period
    this.resetStats();
    this.stats.lastReportTime = now;
  }

  /**
   * Get current statistics (for health checks or monitoring)
   */
  getStats(): {
    overall: LatencyMetrics;
    byType: Record<string, LatencyMetrics>;
  } {
    const byType: Record<string, LatencyMetrics> = {};
    this.stats.byType.forEach((metrics, type) => {
      byType[type] = { ...metrics };
    });

    return {
      overall: { ...this.stats.overall },
      byType
    };
  }

  private resetStats(): void {
    this.stats.overall = this.createEmptyMetrics();
    this.stats.byType.clear();
  }
}
