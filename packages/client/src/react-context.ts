import React, { createContext, ReactNode } from 'react';
import { TunnelClient } from './client';

export const TunnelContext = createContext<TunnelClient | null>(null);

export interface TunnelProviderProps {
  client: TunnelClient;
  children: ReactNode;
}

export const TunnelProvider: React.FC<TunnelProviderProps> = ({ client, children }) => {
  return React.createElement(TunnelContext.Provider, { value: client }, children);
};

export function useTunnel(): TunnelClient {
  const context = React.useContext(TunnelContext);
  if (!context) {
    throw new Error('useTunnel must be used within a TunnelProvider');
  }
  return context;
}
