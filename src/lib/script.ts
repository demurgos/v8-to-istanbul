import Protocol from "devtools-protocol";
import fs from "fs";
import Module from "module";
import { CovBranch } from "./branch";
import { CovFunction } from "./function";
import { CovLine } from "./line";
import { IstanbulBranch, IstanbulFileCoverageData, IstanbulFunction } from "./types";
import { SourceLocation } from "@babel/types";

// Node.js injects a header when executing a script.
// TODO: Add `wrapper` to @types/node
const cjsHeader = (Module as any).wrapper[0];

interface IstanbulStatements<S extends keyof any = keyof any> {
  statementMap: Record<S, SourceLocation>;
  s: Record<S, number>;
}

interface IstanbulBranches<B extends keyof any = keyof any> {
  branchMap: Record<B, IstanbulBranch>;
  b: Record<B, number[]>;
}

interface IstanbulFunctions<F extends keyof any = keyof any> {
  fnMap: Record<F, IstanbulFunction>;
  f: Record<F, number>;
}

export class CovScript {
  public readonly path: string;
  public readonly header: string;
  public readonly lines: CovLine[];
  public readonly branches: CovBranch[];
  public readonly functions: CovFunction[];
  public eof: number;

  private constructor(path: string, sourceText: string, isEsm: boolean) {
    this.path = path;
    this.header = isEsm ? "" : cjsHeader;
    this.lines = [];
    this.branches = [];
    this.functions = [];
    this.eof = -1;
    this._buildLines(sourceText, this.lines);
  }

  public static async fromUrl(url: string): Promise<CovScript> {
    const {path, isEsm} = parseUrl(url);
    const sourceText: string = await new Promise<string>((resolve, reject) => {
      fs.readFile(path, "UTF-8", (err, data) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    return new CovScript(path, sourceText, isEsm);
  }

  public static fromUrlSync(url: string): CovScript {
    const {path, isEsm} = parseUrl(url);
    const sourceText: string = fs.readFileSync(path, "UTF-8");
    return new CovScript(path, sourceText, isEsm);
  }

  public applyCoverage(blocks: Protocol.Profiler.FunctionCoverage[]): void {
    for (const block of blocks) {
      for (const range of block.ranges) {
        const startCol = Math.max(0, range.startOffset - this.header.length);
        const endCol = Math.min(this.eof, range.endOffset - this.header.length);
        const lines = this.lines.filter((line: CovLine): boolean => {
          return startCol <= line.endCol && endCol >= line.startCol;
        });

        if (lines.length > 0) {
          if (block.isBlockCoverage) {
            // record branches.
            this.branches.push(new CovBranch(
              lines[0],
              startCol,
              lines[lines.length - 1],
              endCol,
              range.count,
            ));
          } else if (block.functionName !== "") {
            // record functions.
            this.functions.push(new CovFunction(
              block.functionName,
              lines[0],
              startCol,
              lines[lines.length - 1],
              endCol,
              range.count,
            ));
          }
        }

        // record the lines (we record these as statements, such that we're
        // compatible with Istanbul 2.0).
        for (const line of lines) {
          // make sure branch spans entire line; don't record 'goodbye'
          // branch in `const foo = true ? 'hello' : 'goodbye'` as a
          // 0 for line coverage.
          if (startCol <= line.startCol && endCol >= line.endCol) {
            line.count = range.count;
          }
        }
      }
    }
  }

  public toIstanbulFileCoverageData(): IstanbulFileCoverageData {
    return {
      path: this.path,
      ...this._statementsToIstanbul(),
      ...this._branchesToIstanbul(),
      ...this._functionsToIstanbul(),
    };
  }

  public toIstanbul(): any {
    const fileCoverage: IstanbulFileCoverageData = this.toIstanbulFileCoverageData();
    const istanbulOuter = Object.create(null);
    istanbulOuter[fileCoverage.path] = fileCoverage;
    return istanbulOuter;
  }

  private _buildLines(sourceText: string, lines: CovLine[]): void {
    let position = 0;
    sourceText.split("\n").forEach((lineStr: any, i: any) => {
      this.eof = position + lineStr.length;
      lines.push(new CovLine(i + 1, position, this.eof));
      position += lineStr.length + 1; // also add the \n.
    });
  }

  private _statementsToIstanbul(): IstanbulStatements {
    const statementMap = Object.create(null);
    const s = Object.create(null);
    for (const [index, line] of this.lines.entries()) {
      const key: string = String(index);
      statementMap[key] = line.toIstanbul();
      s[key] = line.count;
    }
    return {statementMap, s};
  }

  private _branchesToIstanbul(): IstanbulBranches {
    const branchMap = Object.create(null);
    const b = Object.create(null);
    for (const [index, branch] of this.branches.entries()) {
      const key: string = String(index);
      branchMap[key] = branch.toIstanbul();
      b[key] = [branch.count];
    }
    return {branchMap, b};
  }

  private _functionsToIstanbul(): IstanbulFunctions {
    const fnMap = Object.create(null);
    const f = Object.create(null);
    for (const [index, fn] of this.functions.entries()) {
      const key: string = String(index);
      fnMap[key] = fn.toIstanbul();
      f[key] = fn.count;
    }
    return {fnMap, f};
  }
}

interface ParsedUrl {
  path: string;
  isEsm: boolean;
}

/**
 * Parses the `.url` property from a V8 `ScriptCoverage`.
 *
 * @param url JavaScript script name or URL.
 */
function parseUrl(url: string): ParsedUrl {
  return {
    path: url.replace(/^file:\/\//, ""),
    isEsm: url.startsWith("file://"),
  };
}
