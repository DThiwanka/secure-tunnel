import { TunnelPlugin, TunnelEnvelope, TunnelRequest, TunnelPluginContext } from './types';

export class PluginRegistry {
  private plugins: TunnelPlugin[] = [];

  public register(plugin: TunnelPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered.`);
    }
    this.plugins.push(plugin);
  }

  public getPlugins(): TunnelPlugin[] {
    return [...this.plugins];
  }

  public async runBeforeDecrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.beforeDecrypt) {
        await plugin.beforeDecrypt(envelope, context);
      }
    }
  }

  public async runAfterDecrypt(
    request: TunnelRequest,
    context: TunnelPluginContext,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterDecrypt) {
        await plugin.afterDecrypt(request, context);
      }
    }
  }

  public async runBeforeForward(
    request: TunnelRequest,
    context: TunnelPluginContext,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.beforeForward) {
        await plugin.beforeForward(request, context);
      }
    }
  }

  public async runAfterForward(response: unknown, context: TunnelPluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterForward) {
        await plugin.afterForward(response, context);
      }
    }
  }

  public async runBeforeEncrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    const reversed = [...this.plugins].reverse();
    for (const plugin of reversed) {
      if (plugin.beforeEncrypt) {
        await plugin.beforeEncrypt(envelope, context);
      }
    }
  }

  public async runAfterEncrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    const reversed = [...this.plugins].reverse();
    for (const plugin of reversed) {
      if (plugin.afterEncrypt) {
        await plugin.afterEncrypt(envelope, context);
      }
    }
  }

  public async runOnError(error: Error, context: TunnelPluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        try {
          await plugin.onError(error, context);
        } catch (err) {
          console.error(`Error in plugin "${plugin.name}" onError handler:`, err);
        }
      }
    }
  }
}
