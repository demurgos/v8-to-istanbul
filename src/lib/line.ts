export class CovLine {
  line: any;
  startCol: any;
  endCol: any;
  count: any;

  constructor(line: any, startCol: any, endCol: any) {
    this.line = line;
    this.startCol = startCol;
    this.endCol = endCol;
    this.count = 0;
  }

  toIstanbul() {
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
