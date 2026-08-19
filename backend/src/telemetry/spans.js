'use strict';
let _tracer = null;
function getTracer() {
  if (_tracer) return _tracer;
  try { const { trace } = require('@opentelemetry/api'); _tracer = trace.getTracer('paysphere-backend'); } catch (_e) {}
  return _tracer;
}
const NOOP = { setAttribute() {}, setStatus() {}, recordException() {}, end() {} };
async function withSpan(name, fn) {
  const t = getTracer();
  if (!t) return fn(NOOP);
  return t.startActiveSpan(name, async (span) => {
    try { const r = await fn(span); span.setStatus({ code: 1 }); return r; }
    catch (err) { span.setStatus({ code: 2, message: err.message }); span.recordException(err); throw err; }
    finally { span.end(); }
  });
}
function recordSpanError(err) {
  try { const { trace } = require('@opentelemetry/api'); const s = trace.getActiveSpan(); if (s) s.recordException(err); } catch (_e) {}
}
module.exports = { withSpan, recordSpanError };