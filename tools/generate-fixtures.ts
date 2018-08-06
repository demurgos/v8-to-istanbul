import assert from "assert";
import childProcess from "child_process";
import cri from "chrome-remote-interface";
import Protocol from "devtools-protocol";
import events from "events";
import fs from "fs";
import path from "path";
import url from "url";

async function main(): Promise<void> {
  for await (const fixture of getFixtures()) {
    await generateFixture(fixture);
  }
}

interface Fixture {
  dir: string;
  args: string[];
  output: string;
}

async function* getFixtures(): AsyncIterable<Fixture> {
  const projectRoot = path.resolve(__dirname, "..");
  const fixturesDir = path.resolve(projectRoot, "src", "test", "fixtures");
  for (const itemName of await fs.promises.readdir(fixturesDir)) {
    const itemPath = path.resolve(fixturesDir, itemName);
    if (!(await fs.promises.lstat(itemPath)).isDirectory()) {
      continue;
    }
    yield {
      dir: itemPath,
      args: [path.resolve(itemPath, "main.js")],
      output: path.resolve(itemPath, "v8.json"),
    };
  }
}

async function generateFixture(fixture: Fixture): Promise<void> {
  const [proc, port] = await spawnInspected(fixture.args);
  let data: CoverageData[];
  try {
    data = await getCoverage(port);
    data = normalizeData(data, fixture.dir);
  } finally {
    proc.kill();
  }
  return writeJson(fixture.output, data);
}

const DEBUGGER_URI_RE = /ws:\/\/.*?:(\d+)\//;
const SPAWN_INSPECTED_TIMEOUT = 1000; // Timeout in milliseconds
const GET_COVERAGE_TIMEOUT = 1000; // Timeout in milliseconds

/**
 * Spawns a new Node process with an active inspector.
 *
 * @param args CLI arguments.
 * @return A pair, the first item is the spawned process, the second is the port number.
 */
async function spawnInspected(args: string[]): Promise<[childProcess.ChildProcess, number]> {
  const proc: childProcess.ChildProcess = childProcess.spawn(
    process.execPath,
    [`--inspect=0`, ...args],
    {stdio: "pipe"},
  );

  const port = await new Promise<number>((resolve, reject) => {
    const timeoutId: NodeJS.Timer = setTimeout(onTimeout, SPAWN_INSPECTED_TIMEOUT);
    let stderrBuffer: Buffer = Buffer.alloc(0);
    proc.stderr.on("data", onStderrData);
    proc.once("error", onError);
    proc.once("exit", onExit);

    function onStderrData(chunk: Buffer): void {
      stderrBuffer = Buffer.concat([stderrBuffer, chunk]);
      const stderrStr = stderrBuffer.toString("UTF-8");
      const match = DEBUGGER_URI_RE.exec(stderrStr);
      if (match === null) {
        return;
      }
      const result: number = parseInt(match[1], 10);
      removeListeners();
      resolve(result);
    }

    function onError(err: Error): void {
      removeListeners();
      reject(new Error(`Unable to spawn with inspector (error}): ${args}: ${err.stack}`));
      proc.kill();
    }

    function onExit(code: number | null, signal: string | null): void {
      removeListeners();
      reject(new Error(`Unable to spawn with inspector (early exit, ${code}, ${signal}): ${args}`));
    }

    function onTimeout(): void {
      removeListeners();
      reject(new Error(`Unable to spawn with inspector (timeout): ${args}`));
      proc.kill();
    }

    function removeListeners(): void {
      proc.stderr.removeListener("data", onStderrData);
      proc.removeListener("error", onError);
      proc.removeListener("exit", onExit);
      clearTimeout(timeoutId);
    }
  });

  return [proc, port];
}

interface CoverageData {
  url: string;
  source: string;
  functions: Protocol.Profiler.FunctionCoverage[];
}

async function getCoverage(port: number): Promise<CoverageData[]> {
  return new Promise<CoverageData[]>(async (resolve, reject) => {
    const timeoutId: NodeJS.Timer = setTimeout(onTimeout, GET_COVERAGE_TIMEOUT);
    let client: Protocol.ProtocolApi;
    let mainExecutionContextId: Protocol.Runtime.ExecutionContextId | undefined;
    let state: string = "WaitingForMainContext"; // TODO: enum
    try {
      client = await cri({port});
      debug("Connected");

      await client.Profiler.enable();
      await client.Profiler.startPreciseCoverage({callCount: true, detailed: true});
      await client.Debugger.enable();
      debug("Enabled profiler and debugger");

      (client as any as events.EventEmitter).once("Runtime.executionContextCreated", onMainContextCreation);
      (client as any as events.EventEmitter).on("Runtime.executionContextDestroyed", onContextDestruction);

      await client.Runtime.enable();
    } catch (err) {
      removeListeners();
      reject(err);
    }

    function onMainContextCreation(ev: Protocol.Runtime.ExecutionContextCreatedEvent) {
      debug(`Main context created: ${ev.context.id}`);
      assert(state === "WaitingForMainContext");
      mainExecutionContextId = ev.context.id;
      state = "WaitingForMainContextDestruction";
    }

    async function onContextDestruction(ev: Protocol.Runtime.ExecutionContextDestroyedEvent): Promise<void> {
      assert(state === "WaitingForMainContextDestruction");
      if (ev.executionContextId !== mainExecutionContextId) {
        debug(`Context destruction: ${ev.executionContextId}`);
        return;
      }
      debug(`Main context destruction: ${ev.executionContextId}`);
      state = "WaitingForCoverage";

      try {
        debug("Querying coverage.");
        // await client.Profiler.stopPreciseCoverage();
        await client.HeapProfiler.collectGarbage();
        const {result: coverageList} = await client.Profiler.takePreciseCoverage();
        const result: CoverageData[] = [];
        debug("Querying sources.");
        for (const coverage of coverageList) {
          const {scriptSource: source} = await client.Debugger.getScriptSource(coverage);
          result.push({
            url: coverage.url,
            source,
            functions: coverage.functions,
          });
        }
        debug("Completed coverage and sources acquisition.");
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        removeListeners();
      }
    }

    function onTimeout(): void {
      removeListeners();
      reject(new Error(`Unable to get V8 coverage (timeout)`));
    }

    function removeListeners(): void {
      (client as any as events.EventEmitter).removeListener("Runtime.executionContextCreated", onMainContextCreation);
      (client as any as events.EventEmitter).removeListener("Runtime.executionContextDestroyed", onContextDestruction);
      clearTimeout(timeoutId);
      (client as any).close();
    }
  });
}

async function writeJson(p: string, data: any): Promise<void> {
  const json: string = JSON.stringify(data, null, 2);
  return fs.promises.writeFile(p, json, {encoding: "UTF-8"});
}

function normalizeData(
  coverages: ReadonlyArray<CoverageData>,
  baseDir: string,
): CoverageData[] {
  const result: CoverageData[] = [];
  for (const coverage of coverages) {
    const urlInfo = getUrlInfo(coverage.url, baseDir);
    if (urlInfo.normalized !== undefined) {
      result.push({
        url: urlInfo.normalized,
        source: coverage.source,
        functions: coverage.functions,
      });
    }
  }
  result.sort(compare);

  function compare(a: CoverageData, b: CoverageData): -1 | 1 {
    if (a.url === b.url) {
      throw new Error(`Unexpected equal URLs: ${a.url}`);
    } else {
      return a.url < b.url ? -1 : 1;
    }
  }

  return result;
}

interface UrlInfo {
  url: string;
  isFileUrl: boolean;
  isAbsolute: boolean;
  posixFilePath: string;
  normalized: string | undefined;
}

function getUrlInfo(scriptUrl: string, posixBaseDir: string): UrlInfo {
  if (process.platform === "win32") {
    // Should not matter that much: this is just the generation of the fixtures.
    // They are commited.
    throw new Error("NotSupported: win32 platform");
  }

  let isFileUrl: boolean;
  let posixFilePath: string;
  if (scriptUrl.startsWith("file://")) {
    isFileUrl = true;
    posixFilePath = decodeURI(new url.URL(scriptUrl).pathname.substr((process.platform as any) === "win32" ? 1 : 0));
  } else {
    isFileUrl = false;
    posixFilePath = scriptUrl;
  }
  const isAbsolute: boolean = path.posix.isAbsolute(posixFilePath);
  let normalized: undefined | string;
  if (isAbsolute && isDescendantOf(posixFilePath, posixBaseDir)) {
    normalized = path.posix.join("/", path.posix.relative(posixBaseDir, posixFilePath));
    if (isFileUrl) {
      const tmp: url.URL = new url.URL(scriptUrl);
      tmp.pathname = encodeURI(normalized);
      normalized = tmp.toString();
    }
  }

  return {
    url: scriptUrl,
    isFileUrl,
    isAbsolute,
    posixFilePath,
    normalized,
  };
}

function isDescendantOf(descendantPosixPath: string, ancestorPosixPath: string): boolean {
  if (descendantPosixPath === ancestorPosixPath) {
    return false;
  }
  while (descendantPosixPath !== path.posix.dirname(descendantPosixPath)) {
    descendantPosixPath = path.posix.dirname(descendantPosixPath);
    if (descendantPosixPath === ancestorPosixPath) {
      return true;
    }
  }
  return false;
}

function debug(...args: any[]): void {
  // tslint:disable-next-line:no-string-literal
  if (process.env["DEBUG"] === "1") {
    console.debug(...args);
  }
}

main();
