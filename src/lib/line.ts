import { SourceLocation } from "@babel/types";

export class CovLine {
  public readonly line: number;
  public readonly startCol: number;
  public readonly endCol: number;
  public count: number;

  constructor(line: number, startCol: number, endCol: number) {
    this.line = line;
    this.startCol = startCol;
    this.endCol = endCol;
    this.count = 0;
  }

  public toIstanbul(): SourceLocation {
    return {
      start: {
        line: this.line,
        column: 0,
      },
      end: {
        line: this.line,
        column: this.endCol - this.startCol,
      },
    };
  }
}
