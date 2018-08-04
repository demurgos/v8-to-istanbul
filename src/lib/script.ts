import assert from "assert";
import Protocol from "devtools-protocol";
import fs from "fs";
import Module from "module";
import { CovBranch } from "./branch";
import { CovFunction } from "./function";
import { CovLine } from "./line";
import { IstanbulFileCoverageData } from "./types";

// Node.js injects a header when executing a script.
// TODO: Add `wrapper` to @types/node
const cjsHeader = (Module as any).wrapper[0];

export class CovScript {
  public readonly path: string;
  public readonly header: string;
  public readonly lines: CovLine[];
  public readonly branches: CovBranch[];
  public readonly functions: CovFunction[];
  public eof: number;

  constructor(scriptPath: string) {
    assert(typeof scriptPath === "string", "scriptPath must be a string");
    const {path, isESM} = parsePath(scriptPath);
    const source = fs.readFileSync(path, "utf8");
    this.path = path;
    this.header = isESM ? "" : cjsHeader;
    this.lines = [];
    this.branches = [];
    this.functions = [];
    this.eof = -1;
    this._buildLines(source, this.lines);
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

  public toIstanbul(): any {
    const istanbulInner: IstanbulFileCoverageData = {
      path: this.path,
      ...this._statementsToIstanbul(),
      ...this._branchesToIstanbul(),
      ...this._functionsToIstanbul(),
    };
    const istanbulOuter = Object.create(null);
    istanbulOuter[istanbulInner.path] = istanbulInner;
    return istanbulOuter;
  }

  private _buildLines(source: any, lines: any) {
    let position = 0;
    source.split("\n").forEach((lineStr: any, i: any) => {
      this.eof = position + lineStr.length;
      lines.push(new CovLine(i + 1, position, this.eof));
      position += lineStr.length + 1; // also add the \n.
    });
  }

  private _statementsToIstanbul(): {statementMap: any, s: any} {
    const statementMap = Object.create(null);
    const s = Object.create(null);
    for (const [index, line] of this.lines.entries()) {
      const key: string = String(index);
      statementMap[key] = line.toIstanbul();
      s[key] = line.count;
    }
    return {statementMap, s};
  }

  private _branchesToIstanbul(): {branchMap: any, b: any} {
    const branchMap = Object.create(null);
    const b = Object.create(null);
    for (const [index, branch] of this.branches.entries()) {
      const key: string = String(index);
      branchMap[key] = branch.toIstanbul();
      b[key] = [branch.count];
    }
    return {branchMap, b};
  }

  private _functionsToIstanbul(): {fnMap: any, f: any} {
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

function parsePath(scriptPath: string) {
  return {
    path: scriptPath.replace("file://", ""),
    isESM: scriptPath.indexOf("file://") !== -1,
  };
}
