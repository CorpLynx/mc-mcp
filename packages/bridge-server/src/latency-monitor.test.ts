import { LatencyMonitor } from './latency-monitor';
import { Logger } from './logger';

describe('LatencyMonitor', () => {
  let logger: Logger;
  let monitor: LatencyMonitor;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    monitor = new LatencyMonitor(logger, 1000);
  });

  afterEach(() => {
    monitor.stopReporting();
  });

  describe('recordLatency', () => {
    it('should record latency for a message type', () => {
      monitor.recordLatency('event', 50);
      
      const stats = monitor.getStats();
      expect(stats.overall.count).toBe(1);
      expect(stats.overall.avgMs).toBe(50);
      expect(stats.overall.minMs).toBe(50);
      expect(stats.overall.maxMs).toBe(50);
      expect(stats.overall.over100ms).toBe(0);
    });

    it('should track multiple latencies and calculate correct averages', () => {
      monitor.recordLatency('event', 30);
      monitor.recordLatency('event', 70);
      monitor.recordLatency('command', 50);
      
      const stats = monitor.getStats();
      expect(stats.overall.count).toBe(3);
      expect(stats.overall.avgMs).toBe(50); // (30 + 70 + 50) / 3
      expect(stats.overall.minMs).toBe(30);
      expect(stats.overall.maxMs).toBe(70);
    });

    it('should track latencies by message type', () => {
      monitor.recordLatency('event', 30);
      monitor.recordLatency('event', 70);
      monitor.recordLatency('command', 100);
      
      const stats = monitor.getStats();
      expect(stats.byType['event'].count).toBe(2);
      expect(stats.byType['event'].avgMs).toBe(50);
      expect(stats.byType['command'].count).toBe(1);
      expect(stats.byType['command'].avgMs).toBe(100);
    });

    it('should count messages exceeding 100ms threshold', () => {
      monitor.recordLatency('event', 50);
      monitor.recordLatency('event', 150);
      monitor.recordLatency('command', 200);
      
      const stats = monitor.getStats();
      expect(stats.overall.over100ms).toBe(2);
      expect(stats.byType['event'].over100ms).toBe(1);
      expect(stats.byType['command'].over100ms).toBe(1);
    });

    it('should handle edge case of exactly 100ms', () => {
      monitor.recordLatency('event', 100);
      
      const stats = monitor.getStats();
      expect(stats.overall.over100ms).toBe(0);
    });

    it('should handle edge case of 101ms', () => {
      monitor.recordLatency('event', 101);
      
      const stats = monitor.getStats();
      expect(stats.overall.over100ms).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no latencies recorded', () => {
      const stats = monitor.getStats();
      
      expect(stats.overall.count).toBe(0);
      expect(stats.overall.avgMs).toBe(0);
      expect(stats.overall.minMs).toBe(Infinity);
      expect(stats.overall.maxMs).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });

    it('should return a copy of stats, not the internal state', () => {
      monitor.recordLatency('event', 50);
      
      const stats1 = monitor.getStats();
      stats1.overall.count = 999;
      
      const stats2 = monitor.getStats();
      expect(stats2.overall.count).toBe(1);
    });
  });

  describe('reportStats', () => {
    it('should reset stats after reporting', () => {
      monitor.recordLatency('event', 50);
      monitor.recordLatency('command', 75);
      
      expect(monitor.getStats().overall.count).toBe(2);
      
      monitor.reportStats();
      
      const stats = monitor.getStats();
      expect(stats.overall.count).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });

    it('should handle reporting with no data', () => {
      // Should not throw
      expect(() => monitor.reportStats()).not.toThrow();
    });
  });

  describe('startReporting and stopReporting', () => {
    it('should start and stop periodic reporting without errors', () => {
      expect(() => {
        monitor.startReporting();
        monitor.stopReporting();
      }).not.toThrow();
    });
  });
});
