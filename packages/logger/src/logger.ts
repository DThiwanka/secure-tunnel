export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  private serviceName: string;

  constructor(serviceName = 'SecureTunnel') {
    this.serviceName = serviceName;
  }

  public info(message: string, context?: Record<string, unknown>): void {
    console.log(this.format('INFO', message, context));
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.format('WARN', message, context));
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.error(
      this.format('ERROR', message, {
        ...context,
        errorMessage: error?.message,
        errorStack: error?.stack,
      }),
    );
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    console.debug(this.format('DEBUG', message, context));
  }

  private format(level: string, message: string, context?: Record<string, unknown>): string {
    const logObj = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      ...context,
    };
    return JSON.stringify(logObj);
  }
}
