import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing(): void {
  if (sdk) {
    return; // Already initialized
  }

  sdk = new NodeSDK({
    resourceDetectors: [],
    serviceName: 'enterprise-auth-system',
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable instrumentations that are not needed
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
}

/**
 * Shutdown tracing gracefully
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/**
 * Get the tracer instance
 */
export function getTracer() {
  return trace.getTracer('enterprise-auth-system');
}

/**
 * Create a new span for an operation
 */
export function startSpan(name: string, attributes?: Record<string, any>): Span {
  const tracer = getTracer();
  return tracer.startSpan(name, {
    attributes,
  });
}

/**
 * Execute a function within a span context
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
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
  });
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception in the current span
 */
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
