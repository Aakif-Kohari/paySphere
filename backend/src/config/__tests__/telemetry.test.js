'use strict';

const TelemetryService = require('../telemetry');

describe('TelemetryService', () => {
  it('should initialize OpenTelemetry SDK without throwing errors', () => {
    expect(() => TelemetryService.initTelemetry('test-service')).not.toThrow();
  });

  it('should execute wrapped functions inside withSpan tracing wrapper', async () => {
    const fn = jest.fn(async ({ traceId, spanId }) => {
      expect(traceId).toBeDefined();
      expect(spanId).toBeDefined();
      return 'success';
    });

    const result = await TelemetryService.withSpan('test.span', { testKey: 'val' }, fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors through withSpan while capturing span metrics', async () => {
    const fn = jest.fn(async () => {
      throw new Error('Span processing failed');
    });

    await expect(TelemetryService.withSpan('error.span', {}, fn)).rejects.toThrow('Span processing failed');
  });

  it('should inject W3C traceparent headers', () => {
    const headers = TelemetryService.injectTraceContext({ existingHeader: 'value' });
    expect(headers.existingHeader).toBe('value');
    expect(headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(headers.tracestate).toBe('paysphere=active');
  });

  it('should extract W3C traceparent headers from carrier', () => {
    const carrier = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
    const extracted = TelemetryService.extractTraceContext(carrier);
    expect(extracted.traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });
});
