#!/usr/bin/env ts-node

import fs from "fs";
import path from "path";
import "should";
import tap from "tap";
import { CovScript } from "../lib/script";
import { runFixture } from "./utils/run-fixture";

tap.mochaGlobals();
declare const describe: any;
declare const it: any;

describe("CovScript", () => {
  describe("fromUrlSync", () => {
    it("creates line instance for each line in script", () => {
      const script = CovScript.fromUrlSync(
        require.resolve("./fixtures/scripts/functions.js"),
      );
      script.lines.length.should.equal(49);
      script.header.length.should.equal(62); // common-js header.
    });

    it("handles ESM style paths", () => {
      const script = CovScript.fromUrlSync(
        `file://${require.resolve("./fixtures/scripts/functions.js")}`,
      );
      script.lines.length.should.equal(49);
      script.header.length.should.equal(0); // ESM header.
    });
  });

  // execute JavaScript files in fixtures directory; these
  // files contain the raw v8 output along with a set of
  // assertions. the original scripts can be found in the
  // fixtures/scripts folder.
  const fixtureRoot = path.resolve(__dirname, "./fixtures");
  fs.readdirSync(fixtureRoot).forEach((file) => {
    const fixturePath = path.resolve(fixtureRoot, file);
    const stats = fs.lstatSync(fixturePath);
    if (stats.isFile()) {
      const fixture = require(fixturePath).default;
      runFixture(fixture);
    }
  });
});
