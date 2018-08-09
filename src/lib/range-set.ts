import assert from "assert";
import Protocol from "devtools-protocol";

// Private alias (shorter)
type Range = Protocol.Profiler.CoverageRange;

/**
 * A range set represents a contiguous group of ranges with counts.
 *
 * This is a relatively efficient data structure to flatten V8 coverage ranges
 * and then query counts for leaf nodes of the AST.
 */
export class RangeSet {
  private readonly splits: ReadonlyArray<number>;
  private readonly counts: ReadonlyArray<number>;

  /**
   * Creates a RangeSet from a list of V8 coverage ranges.
   *
   * The constructor makes the following assumptions about the input ranges:
   * - `ranges` is not empty.
   * - There is no empty `range`.
   * - `ranges[0]` contains all the other ranges.
   * - For any two ranges A and B where A is before B in the list, we have
   *   either `A ∩ B = ∅` (no overlap) or `B ⊆ A` (B included in A)
   *
   * @param ranges Input V8 coverage ranges.
   */
  constructor(ranges: Protocol.Profiler.CoverageRange[]) {
    // The V8 ranges start with the largest range, and subsequent ranges
    // overwrite the count inside the range.
    const first: Range = ranges[0];
    const splits: number[] = [first.startOffset, first.endOffset];
    const counts: number[] = [first.count];

    // Start at 1: skip first range
    for (let i: number = 1; i < ranges.length; i++) {
      const {startOffset, endOffset, count} = ranges[i];
      const rightIdx: number = binarySearch(splits, endOffset);
      if (splits[rightIdx] !== endOffset) {
        splits.splice(rightIdx + 1, 0, endOffset);
        counts.splice(rightIdx, 0, counts[rightIdx]);
      }
      let leftIdx: number = binarySearch(splits, startOffset);
      if (splits[leftIdx] !== startOffset) {
        leftIdx++;
        splits.splice(leftIdx, 0, startOffset);
        counts.splice(leftIdx, 0, count);
      }
      counts[leftIdx] = count;
    }

    this.splits = splits;
    this.counts = counts;
  }

  public getRanges(): Protocol.Profiler.CoverageRange[] {
    const result: Range[] = [];
    for (const [idx, count] of this.counts.entries()) {
      const startOffset: number = this.splits[idx];
      const endOffset: number = this.splits[idx + 1];
      result.push({startOffset, endOffset, count});
    }
    return result;
  }

  public getStartOffset(): number {
    return this.splits[0];
  }

  public getEndOffset(): number {
    return this.splits[this.splits.length - 1];
  }

  // TODO: Take a single index as input? Would remove need for checks.
  public getCount(startOffset: number, endOffset: number): number {
    assert(startOffset < endOffset);
    const thisStart = this.getStartOffset();
    const thisEnd = this.getEndOffset();
    assert(thisStart <= startOffset && endOffset <= thisEnd);
    const startIdx = binarySearch(this.splits, startOffset);
    assert(endOffset <= this.splits[startIdx + 1]);
    return this.counts[startIdx];
  }
}

// array: sorted, at least 2 items
// value: greater than or equal to array[0]
// returns: largest index for an item with a value lesser than or equal to `value`
function binarySearch(array: ReadonlyArray<number>, value: number): number {
  let [left, right] = [0, array.length - 1];
  if (value >= array[right]) {
    return right;
  }
  while (left + 1 < right) {
    const mid = Math.floor((left + right) / 2);
    const midValue = array[mid];
    if (midValue <= value) {
      left = mid;
    } else {
      right = mid;
    }
  }
  return left;
}
