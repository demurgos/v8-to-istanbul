import { SourceLocation } from "@babel/types";

/**
 * Interface for Istanbul's `FileCoverage` options.
 *
 * @param S Type of the keys of `statementMap` and `s`
 * @param F Type of the keys of `fnMap` and `f`
 * @param B Type of the keys of `branchMap` and `b`
 * @see https://github.com/istanbuljs/istanbuljs/blob/829e658dfa91e3a9533842be9ce940dbe7785c09/packages/istanbul-lib-coverage/lib/file.js#L151
 */
export interface IstanbulFileCoverageData<S extends keyof any = keyof any, F extends keyof any = keyof any, B extends keyof any = keyof any> {
  /**
   * The file path for which coverage is being tracked.
   */
  path: string;

  /**
   * Map of statement locations keyed by statement index.
   */
  statementMap: Record<S, SourceLocation>;

  /**
   * Map of function metadata keyed by function index.
   */
  fnMap: Record<F, IstanbulFunction>;

  /**
   * Map of branch metadata keyed by branch index.
   */
  branchMap: Record<B, IstanbulBranch>;

  /**
   * Hit counts for statements.
   */
  s: Record<S, number>;

  /**
   * Hit count for functions.
   */
  f: Record<F, number>;

  /**
   * Hit count for branches.
   */
  b: Record<B, number>;
}

/**
 * Represents the recognized branch types.
 *
 * Ultimately, it seems that Istanbul does not care about the exact value.
 * That's why this union has `string` (which absorbs the other possibilities).
 *
 * The types listed explicitly corresponds to the ones created by Instanbul's
 * instrumentation lib. See first parameter to `newBranch` calls.
 *
 * @see https://github.com/istanbuljs/istanbuljs/blob/71b815d111af5181196173f8af94f14510bb5f7b/packages/istanbul-lib-instrument/src/visitor.js
 */
export type IstanbulBranchType = "binary-expr" | "cond-expr" | "default-arg" | "if" | "switch" | string;

export interface IstanbulBranch {
  type: IstanbulBranchType;

  /**
   * 1-based index of the first line of this branch.
   */
  line: number;
  loc: SourceLocation;
  locations: SourceLocation[];
}

export interface IstanbulFunction {
  name: string;
  decl: SourceLocation;
  loc: SourceLocation;
  line: number;
}
