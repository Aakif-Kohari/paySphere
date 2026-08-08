/**
 * GraphQL wiring.
 *
 * #539 mounted Apollo inline in `app.js`:
 *
 *     const apolloServer = new ApolloServer({ typeDefs, resolvers });
 *     await apolloServer.start();
 *     app.use("/graphql", cors(), express.json(), expressMiddleware(apolloServer));
 *
 * `backend` is CommonJS, so the `await` is a syntax error and the whole file
 * stopped parsing — which is how a feature nobody could reach also stopped the
 * server from booting (#792).
 *
 * `ApolloServer.start()` is genuinely asynchronous, so it cannot happen while
 * `app.js` is being required. It belongs in the startup sequence next to
 * `connectDB()` and the migrations, which is where `index.js` calls this from.
 *
 * The require is deliberately *inside* the function and guarded. Neither
 * `@apollo/server`, `@as-integrations/express` nor `graphql` is declared in
 * `backend/package.json` — #539 never added them — so on a checkout of `main`
 * the require throws `MODULE_NOT_FOUND`. Booting the whole API is not something
 * an optional reporting endpoint gets to veto, so a missing package downgrades
 * to a warning and the rest of the server comes up without `/graphql`.
 *
 * Note that the schema itself is unauthenticated and unscoped by tenant
 * (#795). Until that is fixed, this stays behind the missing-dependency guard
 * rather than being wired up eagerly.
 */

const logger = require('../utils/logger');

/**
 * Are the GraphQL packages actually installed?
 *
 * Separated out so the caller can tell "not installed" from "failed to start",
 * and so the tests can assert the guard without a fake `node_modules`.
 *
 * @returns {boolean}
 */
function isGraphQLAvailable() {
  try {
    require.resolve('@apollo/server');
    require.resolve('@as-integrations/express');
    require.resolve('graphql');
    return true;
  } catch {
    return false;
  }
}

/**
 * Start Apollo and mount it on the app.
 *
 * Mounted after `app.js` has already registered its error handlers, which is
 * safe: every handler in that file takes four arguments, and Express skips
 * four-argument middleware during normal request dispatch. A route added later
 * is still reached.
 *
 * @param {import('express').Express} app
 * @returns {Promise<boolean>} true if `/graphql` was mounted
 */
async function attachGraphQL(app) {
  if (!isGraphQLAvailable()) {
    logger.warn(
      'GraphQL not mounted: @apollo/server, @as-integrations/express and graphql are not installed. Add them to backend/package.json to enable /graphql.',
    );
    return false;
  }

  try {
    const express = require('express');
    const { ApolloServer } = require('@apollo/server');
    const { expressMiddleware } = require('@as-integrations/express');
    const { typeDefs, resolvers } = require('./schema');

    const apolloServer = new ApolloServer({ typeDefs, resolvers });
    await apolloServer.start();

    app.use('/graphql', express.json(), expressMiddleware(apolloServer));

    logger.info('GraphQL mounted at /graphql');
    return true;
  } catch (error) {
    // Same reasoning as the guard above: a reporting endpoint that fails to
    // start is a degraded feature, not a reason to refuse to serve payroll.
    logger.error('GraphQL failed to start; continuing without /graphql', {
      error: error.message,
    });
    return false;
  }
}

module.exports = { attachGraphQL, isGraphQLAvailable };
