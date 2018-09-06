import { parse as babelParse } from "@babel/parser";
import babelTraverse, { NodePath } from "@babel/traverse";
import { File, Node, SourceLocation } from "@babel/types";
import Protocol from "devtools-protocol";
import Module from "module";
import { IstanbulFileCoverageData, V8Coverage } from "./types";

export { IstanbulBranch, IstanbulFileCoverageData, IstanbulFunction, V8Coverage } from "./types";

const CJS_PREFIX_LEN: number = (Module as any).wrapper[0].length;
const CJS_SUFFIX_LEN: number = (Module as any).wrapper[1].length;

// Private aliases (shorter names)
type FnCov = Protocol.Profiler.FunctionCoverage;
type CovRange = Protocol.Profiler.CoverageRange;

/**
 * Converts a V8 ScriptCoverage object to an Istanbul FileCoverage data object.
 *
 * @param coverage V8 script coverage to convert. It must have the `url` and `function` fields.
 * @param sourceText Source text corresponding to the coverage result.
 */
export function v8ToIstanbul(coverage: V8Coverage, sourceText: string): IstanbulFileCoverageData {
  const sourceType: "script" | "module" = coverage.url.startsWith("file://") ? "module" : "script";
  return Converter.convert(coverage, sourceText, sourceType);
}

export function unwrapNodeCjsCoverage(coverage: V8Coverage): V8Coverage {
  const wrapperFn: FnCov = coverage.functions[0];
  const wrapperRange: CovRange = wrapperFn.ranges[0];
  const sourceLen: number = wrapperRange.endOffset - (CJS_PREFIX_LEN + CJS_SUFFIX_LEN);
  const functions: FnCov[] = [];
  for (const fn of coverage.functions) {
    if (fn === wrapperFn) {
      continue;
    }
    const ranges: CovRange[] = [];
    for (const range of fn.ranges) {
      ranges.push({
        startOffset: Math.max(range.startOffset - CJS_PREFIX_LEN, 0),
        endOffset: Math.min(range.endOffset - CJS_PREFIX_LEN, sourceLen),
        count: range.count,
      });
    }
    functions.push({
      functionName: fn.functionName,
      ranges,
      isBlockCoverage: fn.isBlockCoverage,
    });
  }
  return {url: coverage.url, functions};
}

export function unwrapNodeCjsSource(sourceText: string): string {
  return sourceText.substring(CJS_PREFIX_LEN, sourceText.length - CJS_SUFFIX_LEN);
}

interface CovBlock {
  node: Node;
  scope: any;
  path: any;
  v8: Protocol.Profiler.FunctionCoverage;
  isFunction: boolean;
}

class Converter {
  public static convert(
    coverage: V8Coverage,
    sourceText: string,
    sourceType: "script" | "module",
  ): IstanbulFileCoverageData {
    const ast: File = babelParse(sourceText, {sourceType, plugins: ["dynamicImport"]});
    const converter = new Converter(ast, coverage);
    return {
      path: coverage.url,
      ...converter.getStatements(),
      ...converter.getFunctions(),
      branchMap: Object.create(null),
      b: Object.create(null),
    };
  }

  // boolean: isFunction
  private readonly ast: File;
  private readonly blocks: Set<CovBlock>;
  private readonly blockRoots: Set<Node>;
  // tslint:disable-next-line:variable-name
  private _nextFid: number;
// tslint:disable-next-line:variable-name
  private _nextSid: number;

  private constructor(ast: File, coverage: V8Coverage) {
    this.ast = ast;
    this.blocks = new Set();
    this.blockRoots = new Set();
    this._nextFid = 0;
    this._nextSid = 0;

    const unmatchedV8: FnCov[] = [...coverage.functions];
    babelTraverse(ast, {
      enter: (path: NodePath) => {
        const v8: FnCov | undefined = popMatchedV8(unmatchedV8, path.node);
        if (v8 !== undefined) {
          this.blocks.add({v8, node: path.node, scope: path.scope, path, isFunction: path.isFunction()});
          this.blockRoots.add(path.node);
        }
      },
    });
    if (unmatchedV8.length > 0) {
      throw new Error("Unable to match all V8 function to an AST Node");
    }
  }

  private nextFid(): string {
    return `f${this._nextFid++}`;
  }

  private nextSid(): string {
    return `s${this._nextSid++}`;
  }

  private getStatements(): any {
    const statementMap: Record<string, SourceLocation> = Object.create(null);
    const s: Record<string, number> = Object.create(null);

    for (const block of this.blocks) {
      babelTraverse(
        block.node,
        {
          enter: (path: NodePath) => {
            if (path.isStatement() && !(path.isBlockStatement() || path.isDeclaration())) {
              const key: string = this.nextSid();
              // assert loc is defined
              statementMap[key] = path.node.loc!;
              s[key] = getCount(block.v8.ranges, path.node);
            }
            if (this.blockRoots.has(path.node)) {
              path.skip();
            }
          },
        },
        block.scope,
        block.path,
      );
    }
    return {statementMap, s};
  }

  private getFunctions(): any {
    const fnMap: Record<string, SourceLocation> = Object.create(null);
    const f: Record<string, number> = Object.create(null);

    for (const block of this.blocks) {
      if (!block.isFunction) {
        continue;
      }
      const key: string = this.nextFid();
      // assert loc is defined
      fnMap[key] = block.node.loc!;
      f[key] = block.v8.ranges[0].count;
    }
    return {fnMap, f};
  }
}

function popMatchedV8(v8List: FnCov[], node: Node): FnCov | undefined {
  let matchedIdx: number | undefined;
  for (const [idx, v8] of v8List.entries()) {
    const firstRange = v8.ranges[0];
    if (firstRange.startOffset === node.start && firstRange.endOffset === node.end) {
      matchedIdx = idx;
      break;
    }
  }
  if (matchedIdx === undefined) {
    return undefined;
  }
  return v8List.splice(matchedIdx, 1)[0];
}

function getCount(ranges: CovRange[], node: Node): number {
  // TODO: assert node has start/end
  for (const range of ranges) {
    if (range.startOffset <= node.start! && node.end! <= range.endOffset) {
      return range.count;
    }
  }
  throw new Error("Count not found");
}
