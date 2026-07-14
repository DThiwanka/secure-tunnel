import {
  TunnelPlugin,
  TunnelRequest,
  TunnelPluginContext,
  GatewayError,
} from '@secure-tunnel/core';

export interface AuthenticationPluginOptions {
  authenticator: (
    request: TunnelRequest,
    context: TunnelPluginContext,
  ) => Promise<boolean> | boolean;
  unauthorizedStatusCode?: number; // Default 401
}

export class AuthenticationPlugin implements TunnelPlugin {
  public readonly name = 'authentication';
  private authenticator: (
    request: TunnelRequest,
    context: TunnelPluginContext,
  ) => Promise<boolean> | boolean;
  private unauthorizedStatusCode: number;

  constructor(options: AuthenticationPluginOptions) {
    this.authenticator = options.authenticator;
    this.unauthorizedStatusCode =
      options.unauthorizedStatusCode !== undefined ? options.unauthorizedStatusCode : 401;
  }

  public async beforeForward(request: TunnelRequest, context: TunnelPluginContext): Promise<void> {
    try {
      const isAuthenticated = await this.authenticator(request, context);
      if (!isAuthenticated) {
        throw new GatewayError('Unauthorized', this.unauthorizedStatusCode);
      }
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      throw new GatewayError(
        `Authentication failed: ${err.message}`,
        this.unauthorizedStatusCode,
      );
    }
  }
}
