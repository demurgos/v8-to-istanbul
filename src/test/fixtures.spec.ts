import fs from "fs";
import path from "path";
import Protocol from "devtools-protocol";

const FIXTURES_DIR = path.posix.resolve(__dirname, "fixtures");
const DATA_FILE_NAME = "v8.json";

describe("Fixtures", () => {
  for (const fixture of getFixtures()) {
    describe(fixture.name, () => {
      for (const item of fixture.data) {
        it(item.url, () => {
        });
      }
    });
  }
});

interface Fixture {
  name: string;
  data: FixtureData[];
}

interface FixtureData {
  url: string;
  source: string;
  functions: Protocol.Profiler.ScriptCoverage[];
}

function* getFixtures(): Iterable<Fixture> {
  for (const item of fs.readdirSync(FIXTURES_DIR)) {
    const itemPath: string = path.resolve(FIXTURES_DIR, item);
    if (!fs.lstatSync(itemPath).isDirectory()) {
      continue;
    }
    const dataFile: string = path.resolve(itemPath, DATA_FILE_NAME);
    const data = JSON.parse(fs.readFileSync(dataFile, "UTF-8"));
    yield {name: item, data};
  }
}
