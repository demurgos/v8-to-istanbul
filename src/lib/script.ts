import assert from "assert";
import fs from "fs";
import Module from "module";
import { CovLine } from "./line";
import { CovBranch } from "./branch";
import { CovFunction } from "./function";

// Node.js injects a header when executing a script.
// TODO: Add `wrapper` to @types/node
const cjsHeader = (Module as any).wrapper[0];

export class CovScript {
  path: string;
  header: any;
  lines: any;
  branches: any;
  functions: any;
  eof: any;

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

  _buildLines(source: any, lines: any) {
    let position = 0;
    source.split("\n").forEach((lineStr: any, i: any) => {
      this.eof = position + lineStr.length;
      lines.push(new CovLine(i + 1, position, this.eof));
      position += lineStr.length + 1; // also add the \n.
    });
  }

  applyCoverage(blocks: any) {
    blocks.forEach((block: any) => {
      block.ranges.forEach((range: any) => {
        const startCol = Math.max(0, range.startOffset - this.header.length);
        const endCol = Math.min(this.eof, range.endOffset - this.header.length);
        const lines = this.lines.filter((line: any) => {
          return startCol <= line.endCol && endCol >= line.startCol;
        });

        if (block.isBlockCoverage && lines.length) {
          // record branches.
          this.branches.push(new CovBranch(
            lines[0],
            startCol,
            lines[lines.length - 1],
            endCol,
            range.count,
          ));
        } else if (block.functionName && lines.length) {
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

        // record the lines (we record these as statements, such that we're
        // compatible with Istanbul 2.0).
        lines.forEach((line: any) => {
          // make sure branch spans entire line; don't record 'goodbye'
          // branch in `const foo = true ? 'hello' : 'goodbye'` as a
          // 0 for line coverage.
          if (startCol <= line.startCol && endCol >= line.endCol) {
            line.count = range.count;
          }
        });
      });
    });
  }

  toIstanbul() {
    const istanbulInner = Object.assign(
      {path: this.path},
      this._statementsToIstanbul(),
      this._branchesToIstanbul(),
      this._functionsToIstanbul(),
    );
    const istanbulOuter: any = {};
    istanbulOuter[this.path] = istanbulInner;
    return istanbulOuter;
  }

  _statementsToIstanbul() {
    const statements: any = {
      statementMap: {},
      s: {},
    };
    this.lines.forEach((line: any, index: any) => {
      statements.statementMap[`${index}`] = line.toIstanbul();
      statements.s[`${index}`] = line.count;
    });
    return statements;
  }

  _branchesToIstanbul() {
    const branches: any = {
      branchMap: {},
      b: {},
    };
    this.branches.forEach((branch: any, index: any) => {
      branches.branchMap[`${index}`] = branch.toIstanbul();
      branches.b[`${index}`] = [branch.count];
    });
    return branches;
  }

  _functionsToIstanbul() {
    const functions: any = {
      fnMap: {},
      f: {},
    };
    this.functions.forEach((fn: any, index: any) => {
      functions.fnMap[`${index}`] = fn.toIstanbul();
      functions.f[`${index}`] = fn.count;
    });
    return functions;
  }
}

function parsePath(scriptPath: string) {
  return {
    path: scriptPath.replace("file://", ""),
    isESM: scriptPath.indexOf("file://") !== -1,
  };
}
