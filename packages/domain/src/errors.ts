/**
 * Typed error for failures of an upstream open-data service. The UI turns it into a retry
 * message; `retryable` says whether retrying is worth offering.
 */
export interface UpstreamErrorShape {
  kind: 'upstream';
  service: string;
  retryable: boolean;
}

export class UpstreamError extends Error implements UpstreamErrorShape {
  readonly kind = 'upstream' as const;
  readonly service: string;
  readonly retryable: boolean;

  constructor(
    service: string,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'UpstreamError';
    this.service = service;
    this.retryable = options.retryable ?? true;
  }

  /** Plain-data view for serialising across the server boundary. */
  toJSON(): UpstreamErrorShape & { message: string } {
    return {
      kind: this.kind,
      service: this.service,
      retryable: this.retryable,
      message: this.message,
    };
  }
}

export function isUpstreamError(value: unknown): value is UpstreamErrorShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'upstream' &&
    typeof (value as { service?: unknown }).service === 'string' &&
    typeof (value as { retryable?: unknown }).retryable === 'boolean'
  );
}
