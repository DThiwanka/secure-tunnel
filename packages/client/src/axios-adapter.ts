import { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { TunnelClient } from './client';
import { TunnelPluginContext, TunnelEnvelope } from '@secure-tunnel/core';

export interface TunnelAxiosRequestConfig extends InternalAxiosRequestConfig {
  tunnelProcessed?: boolean;
  tunnelContext?: TunnelPluginContext;
}

export function applyAxiosInterceptor(axiosInstance: AxiosInstance, tunnelClient: TunnelClient): void {
  // 1. Request Interceptor
  axiosInstance.interceptors.request.use(
    async (config) => {
      const cfg = config as TunnelAxiosRequestConfig;
      // Avoid processing requests that are already marked or requesting the gateway endpoint directly
      if (cfg.tunnelProcessed || cfg.url === tunnelClient['endpoint']) {
        return config;
      }

      const method = cfg.method || 'get';
      const url = cfg.url || '';
      const headers = (cfg.headers as unknown as Record<string, string>) || {};
      const body = cfg.data;
      const query = cfg.params as Record<string, string>;

      try {
        const { envelope, context } = await tunnelClient.prepareEnvelope(
          method,
          url,
          body,
          headers,
          query,
        );

        // Mutate axios config to forward through the gateway
        cfg.url = tunnelClient['endpoint'];
        cfg.method = 'post';
        cfg.data = envelope;
        cfg.params = {}; // Query parameters are packed in the envelope
        (cfg.headers as unknown as Record<string, string>)['content-type'] = 'application/json';
        cfg.tunnelProcessed = true;
        cfg.tunnelContext = context;

        return config;
      } catch (err) {
        return Promise.reject(err);
      }
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // 2. Response Interceptor
  axiosInstance.interceptors.response.use(
    async (response: AxiosResponse) => {
      const cfg = response.config as TunnelAxiosRequestConfig;
      if (!cfg || !cfg.tunnelProcessed) {
        return response;
      }

      try {
        const envelope = response.data as TunnelEnvelope;
        const decrypted = await tunnelClient.unwrapEnvelope(envelope, cfg.tunnelContext);
        response.data = decrypted;
        return response;
      } catch (err) {
        return Promise.reject(err);
      }
    },
    async (error: AxiosError) => {
      const cfg = error.config as TunnelAxiosRequestConfig;
      if (cfg && cfg.tunnelProcessed && error.response && error.response.data) {
        try {
          const envelope = error.response.data as TunnelEnvelope;
          const decrypted = (await tunnelClient.unwrapEnvelope(
            envelope,
            cfg.tunnelContext,
          )) as { error?: { message?: string } } | undefined;
          error.response.data = decrypted;
          // Set error message to decrypted message if available
          if (decrypted && decrypted.error) {
            error.message = decrypted.error.message || error.message;
          }
        } catch {
          // Fall back to original error if decryption fails
        }
      }
      return Promise.reject(error);
    },
  );
}
