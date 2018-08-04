export class CovBranch {
  startLine: any;
  startCol: any;
  endLine: any;
  endCol: any;
  count: any;

  constructor(startLine: any, startCol: any, endLine: any, endCol: any, count: any) {
    this.startLine = startLine;
    this.startCol = startCol;
    this.endLine = endLine;
    this.endCol = endCol;
    this.count = count;
  }

  toIstanbul() {
    const location = {
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
