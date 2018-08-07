import { SourceLocation } from "@babel/types";
import { CovLine } from "./line";
import { IstanbulFunction } from "./types";

export class CovFunction {
  public readonly name: string;
  public readonly startLine: CovLine;
  public readonly startCol: number;
  public readonly endLine: CovLine;
  public readonly endCol: number;
  public count: number;

  constructor(name: string, startLine: CovLine, startCol: number, endLine: CovLine, endCol: number, count: number) {
    this.name = name;
    this.startLine = startLine;
    this.startCol = startCol;
    this.endLine = endLine;
    this.endCol = endCol;
    this.count = count;
  }

  public toIstanbul(): IstanbulFunction {
    const loc: SourceLocation = {
      start: {
        line: this.startLine.line,
        column: this.startCol - this.startLine.startCol,
      },
      end: {
        line: this.endLine.line,
        column: this.endCol - this.endLine.startCol,
      },
    };
    return {
      name: this.name,
      decl: loc,
      // tslint:disable-next-line:object-literal-shorthand
      loc: loc,
      line: this.startLine.line,
    };
  }
}
