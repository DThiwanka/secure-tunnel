export class TunnelError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = 'TUNNEL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EncryptionError extends TunnelError {
  constructor(message: string) {
    super(message, 400, 'ENCRYPTION_ERROR');
  }
}

export class SignatureError extends TunnelError {
  constructor(message: string) {
    super(message, 401, 'SIGNATURE_ERROR');
  }
}

export class ReplayAttackError extends TunnelError {
  constructor(message: string) {
    super(message, 401, 'REPLAY_ATTACK_ERROR');
  }
}

export class GatewayError extends TunnelError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode, 'GATEWAY_ERROR');
  }
}

export class TimeoutError extends TunnelError {
  constructor(message: string) {
    super(message, 408, 'TIMEOUT_ERROR');
  }
}

export class ValidationError extends TunnelError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
