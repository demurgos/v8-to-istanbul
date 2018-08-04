import { SourceLocation } from "@babel/types";
import { CovLine } from "./line";
import { IstanbulBranch } from "./types";

export class CovBranch {
  public readonly startLine: CovLine;
  public readonly startCol: number;
  public readonly endLine: CovLine;
  public readonly endCol: number;
  public count: number;

  constructor(startLine: CovLine, startCol: any, endLine: any, endCol: any, count: any) {
    this.startLine = startLine;
    this.startCol = startCol;
    this.endLine = endLine;
    this.endCol = endCol;
    this.count = count;
  }

  public toIstanbul(): IstanbulBranch {
    const location: SourceLocation = {
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
      type: "branch",
      line: this.startLine.line,
      loc: location,
      locations: [{...location}],
    };
  }
}
