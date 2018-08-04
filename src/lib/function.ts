export class CovFunction {
  name: string;
  startLine: any;
  startCol: any;
  endLine: any;
  endCol: any;
  count: any;

  constructor(name: string, startLine: any, startCol: any, endLine: any, endCol: any, count: any) {
    this.name = name;
    this.startLine = startLine;
    this.startCol = startCol;
    this.endLine = endLine;
    this.endCol = endCol;
    this.count = count;
  }

  toIstanbul() {
    const loc = {
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
      loc: loc,
      line: this.startLine.line,
    };
  }
}
