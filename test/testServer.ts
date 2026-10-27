import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";

let server: Promise<ColyseusTestServer<typeof appConfig>> | null = null;

// One server for every test file: booting a second after the first shut down fails to matchmake.
// Never shut down here; mocha's `--exit` ends the process.
export function testServer() {
  server ??= boot(appConfig);
  return server;
}
