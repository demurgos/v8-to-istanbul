# v8-to-istanbul

converts from v8 coverage format to [istanbul's coverage format](https://github.com/gotwarlost/istanbul/blob/master/coverage.json.md).

## Usage

```typescript
import Protocol from "devtools-protocol";
import {v8ToIstanbul} from "v8-to-istambul";

// Get a V8 ScriptCoverage.
const v8Coverage: Protocol.Profiler.ScriptCoverage = ...;
// Get the corresponding source text
const sourceText: string = ...;

// Convert it to the Istanbul format.
const istanbulCoverage = v8ToIstanbul(v8Coverage, sourceText);

// The result is a plain object: you can store it and use it to build an
// Istanbul `FileCoverage` instance.
console.info(JSON.stringify(istanbulCoverage));
```

## Testing

To execute tests, simply run:

```bash
npm test
```

To output istanbul coverage data while running tests (useful as you add
new assertions), simply run:

```bash
DEBUG=1 npm test
```
