import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyConnectivity,
  CONNECTIVITY,
} from "../../client/src/utils/networkStatus.js";

test("browser offline is only a hint, not proof the API failed", () => {
  assert.equal(
    classifyConnectivity({ browserOnline: false, lastErrorStatus: null }),
    CONNECTIVITY.OFFLINE_HINT
  );
});

test("an online request with no response is an unavailable API, not offline", () => {
  assert.equal(
    classifyConnectivity({ browserOnline: true, lastErrorStatus: 0 }),
    CONNECTIVITY.UNREACHABLE
  );
});

test("a 5xx while the browser reports online is a server failure", () => {
  assert.equal(
    classifyConnectivity({ browserOnline: true, lastErrorStatus: 503 }),
    CONNECTIVITY.SERVER
  );
});

test("no error while online is connected", () => {
  assert.equal(
    classifyConnectivity({ browserOnline: true, lastErrorStatus: null }),
    CONNECTIVITY.ONLINE
  );
});
