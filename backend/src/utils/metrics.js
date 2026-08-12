/**
 * @fileoverview Prometheus metrics for the PaySphere backend.
 *
 * Exposes a `/metrics` endpoint (Prometheus text format) and tracks basic HTTP
 * request metrics. The Grafana dashboard in `monitoring/grafana-dashboard.json`
 * reads the `http_request_duration_seconds` and `http_requests_total` series
 * produced here, alongside the default Node.js runtime metrics.
 *
 * Issue: #765
 * Docs:  https://github.com/siimon/prom-client
 */

const client = require('prom-client');

// Default Node.js runtime metrics: event loop lag, memory, GC, CPU, handles.
// Skipped under jest so the 10s collection interval does not keep the event
// loop alive and make the test runner wait out its open-handles timeout.
if (process.env.NODE_ENV !== 'test') {
  client.collectDefaultMetrics();
}

// HTTP request tracking, labeled so Grafana can split by route and status.
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

/**
 * Express middleware that records every request that flows through it.
 * Mounted above the route table, once, so all API traffic is captured.
 */
function trackHttpMetrics(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: (req.route && req.route.path) || req.path,
      status: res.statusCode,
    };
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  });
  next();
}

/**
 * Serves the Prometheus text exposition format.
 *
 * Public on purpose (scrapers have no auth token), so it is mounted next to
 * the root probe, outside the `/api` auth and rate-limit stack. Uses
 * `res.end` instead of `res.json` so the response is not passed through the
 * global redaction middleware.
 */
async function metricsHandler(req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = { trackHttpMetrics, metricsHandler };
