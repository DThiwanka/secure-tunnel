import {
  TunnelPlugin,
  TunnelEnvelope,
  TunnelPluginContext,
} from '@secure-tunnel/core';

export class MetricsPlugin implements TunnelPlugin {
  public readonly name = 'metrics';
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private totalDurationMs = 0;

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    this.requestCount++;
    context.state.metricsStartTime = Date.now();
  }

  public async afterForward(_response: unknown, context: TunnelPluginContext): Promise<void> {
    this.successCount++;
    if (context.state.metricsStartTime) {
      this.totalDurationMs += Date.now() - (context.state.metricsStartTime as number);
    }
  }

  public async onError(_error: Error, context: TunnelPluginContext): Promise<void> {
    this.errorCount++;
    if (context.state.metricsStartTime) {
      this.totalDurationMs += Date.now() - (context.state.metricsStartTime as number);
    }
  }

  public getMetrics() {
    return {
      requestCount: this.requestCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      averageDurationMs: this.requestCount > 0 ? this.totalDurationMs / this.requestCount : 0,
    };
  }

  public reset(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.totalDurationMs = 0;
  }
}
