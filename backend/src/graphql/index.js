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
 * The require is deliberately *inside* the function and guarded. #539 never
 * added the three packages to `backend/package.json`, so until #795 the require
 * threw `MODULE_NOT_FOUND` on a clean checkout. They are declared now, and the
 * guard stays: booting the whole API is not something an optional reporting
 * endpoint gets to veto, so a missing or broken package downgrades to a warning
 * and the rest of the server comes up without `/graphql`.
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
    require.resolve('@as-integrations/express5');
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
      'GraphQL not mounted: @apollo/server, @as-integrations/express5 and graphql are not installed.',
    );
    return false;
  }

  try {
    const express = require('express');
    const { ApolloServer } = require('@apollo/server');
    // `@as-integrations/express5`, not `@as-integrations/express` — the latter
    // does not exist on the registry at all, so #539's import could never have
    // resolved even with the package installed. This project is on express@5,
    // which is what the `5` in the name refers to.
    const { expressMiddleware } = require('@as-integrations/express5');
    const { typeDefs, resolvers } = require('./schema');
    const { buildContext } = require('./context');

    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      // Introspection lets anyone enumerate the whole schema. Useful while
      // developing, not something to publish (#795).
      introspection: process.env.NODE_ENV !== 'production',
    });
    await apolloServer.start();

    // `context` is where authentication happens: it runs before any resolver,
    // and what it throws the caller gets instead of data. Every resolver then
    // scopes on `context.tenantId`, which no query argument can influence.
    app.use(
      '/graphql',
      express.json(),
      expressMiddleware(apolloServer, { context: buildContext }),
    );

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
