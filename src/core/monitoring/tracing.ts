import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;

export function initializeTracing(): void {
  if (sdk) {
    return;
  }

  try {
    sdk = new NodeSDK({
      resourceDetectors: [],
      serviceName: 'enterprise-auth-system',
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Silently fail if tracing cannot be initialized
    sdk = null;
  }
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

export function getTracer(): ReturnType<typeof trace.getTracer> {
  return trace.getTracer('enterprise-auth-system');
}

export function startSpan(name: string, attributes?: Record<string, unknown>): Span {
  const tracer = getTracer();
  return tracer.startSpan(name, {
    attributes: attributes as Record<string, string | number | boolean>,
  });
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    name,
    { attributes: attributes as Record<string, string | number | boolean> },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export function addSpanAttributes(attributes: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(key, value);
      }
    });
  }
}

export function addSpanEvent(name: string, attributes?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span) {
    const validAttributes: Record<string, string | number | boolean> = {};
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          validAttributes[key] = value;
        }
      });
    }
    span.addEvent(name, validAttributes);
  }
}

export function recordSpanException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

export default {
  initializeTracing,
  shutdownTracing,
  getTracer,
  startSpan,
  withSpan,
  addSpanAttributes,
  addSpanEvent,
  recordSpanException,
};
