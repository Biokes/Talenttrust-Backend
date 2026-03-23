/**
 * @module index
 * @description Server entry point.
 *
 * Bootstraps the Express application and binds it to a port.
 * Import `createApp` from `./app` in tests — never import this file directly
 * in test suites, as it starts the HTTP server immediately.
 */

import { createApp } from './app';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`TalentTrust API listening on http://localhost:${PORT}`);
});
