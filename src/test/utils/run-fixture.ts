import "should";
import tap from "tap";
import { v8ToIstanbul } from "../../lib/index";
import fs from "fs";

tap.mochaGlobals();
declare const describe: any;
declare const it: any;

export function runFixture(fixture: any) {
  const scriptPath = fixture.coverageV8.url;
  const source = fs.readFileSync(scriptPath, "UTF-8");
  const coverageIstanbul = v8ToIstanbul(fixture.coverageV8, source);

  describe(fixture.describe, () => {
    // run with DEBUG=true to output coverage information to
    // terminal; this is useful when writing new tests.
    it("matches snapshot", () => {
      tap.matchSnapshot(coverageIstanbul);
    });
  });
}
