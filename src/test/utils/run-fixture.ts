import "should";
import tap from "tap";
import toIstanbul from "../../lib/index";

tap.mochaGlobals();
declare const describe: any;
declare const it: any;

export function runFixture(fixture: any) {
  const script = toIstanbul(fixture.coverageV8.url);
  script.applyCoverage(fixture.coverageV8.functions);

  let coverageIstanbul = script.toIstanbul();
  // the top level object is keyed on filename, grab the inner
  // object which is easier to assert against.
  coverageIstanbul = coverageIstanbul[Object.keys(coverageIstanbul)[0]];

  describe(fixture.describe, () => {
    // run with DEBUG=true to output coverage information to
    // terminal; this is useful when writing new tests.
    it("matches snapshot", () => {
      tap.matchSnapshot(coverageIstanbul);
    });
  });
}
