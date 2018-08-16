import chai from "chai";
import Protocol from "devtools-protocol";
import fs from "fs";
import path from "path";
import { v8ToIstanbul } from "../lib";
import { IstanbulFileCoverageData } from "../lib/types";
import { FixtureOptions } from "./fixture-options";

const FIXTURES_DIR = path.posix.resolve(__dirname, "fixtures");
const DATA_FILE_NAME = "v8.json";

describe("Fixtures", () => {
  for (const fixture of getFixtures()) {
    (fixture.skip ? describe.skip : describe)(fixture.name, () => {
      for (const item of fixture.data) {
        if (process.env.SNAPSHOT === "1") {
          it(`Generates a snapshot for: ${item.url}`, async () => {
            const istanbulCoverage: IstanbulFileCoverageData = v8ToIstanbul(item, item.source);
            updateSnapshot(fixture.name, item.url, istanbulCoverage);
          });
        } else {
          it(`Matches the snapshot for: ${item.url}`, async () => {
            const expected: IstanbulFileCoverageData = await getSnapshot(fixture.name, item.url);
            const actual: IstanbulFileCoverageData = v8ToIstanbul(item, item.source);
            chai.assert.deepEqual(actual, expected);
          });
        }
      }
    });
  }
});

interface Fixture {
  name: string;
  dir: string;
  data: FixtureData[];
  skip: boolean;
}

interface FixtureData {
  url: string;
  source: string;
  functions: Protocol.Profiler.FunctionCoverage[];
}

function* getFixtures(): Iterable<Fixture> {
  for (const item of fs.readdirSync(FIXTURES_DIR)) {
    const itemPath: string = path.resolve(FIXTURES_DIR, item);
    if (!fs.lstatSync(itemPath).isDirectory()) {
      continue;
    }
    const dataFile: string = path.resolve(itemPath, DATA_FILE_NAME);
    const data = JSON.parse(fs.readFileSync(dataFile, "UTF-8"));
    let skip: boolean = true;
    try {
      const fixtureOptionsPath = path.resolve(itemPath, "fixture.json");
      const options: FixtureOptions = JSON.parse(fs.readFileSync(fixtureOptionsPath).toString("UTF-8"));
      if (options.skip !== undefined) {
        skip = options.skip;
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
    yield {name: item, dir: itemPath, data, skip};
  }
}

async function getSnapshot(fixtureName: string, url: string): Promise<IstanbulFileCoverageData> {
  const fixtureDir = path.resolve(FIXTURES_DIR, fixtureName);
  const snapshotPath: string = path.resolve(fixtureDir, "snapshot.json");
  let snapshotData: Record<string, any>;
  try {
    snapshotData = JSON.parse(fs.readFileSync(snapshotPath).toString("UTF-8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`Snapshot file does not exit, use \`npm run generate:snapshots\`: ${snapshotPath}`);
    }
    throw err;
  }
  if (snapshotData[url] === undefined) {
    throw new Error(`${snapshotPath} does not have data for ${url}, try to use \`npm run generate:snapshots\``);
  }
  return snapshotData[url];
}

async function updateSnapshot(fixtureName: string, url: string, value: IstanbulFileCoverageData): Promise<void> {
  const fixtureDir = path.resolve(FIXTURES_DIR, fixtureName);
  const snapshotPath: string = path.resolve(fixtureDir, "snapshot.json");
  let snapshotData: Record<string, IstanbulFileCoverageData> = {};
  try {
    snapshotData = JSON.parse(fs.readFileSync(snapshotPath).toString("UTF-8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  snapshotData[url] = value;
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), {encoding: "UTF-8"});
}
