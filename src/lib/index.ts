import { CovScript } from "./script";
import { IstanbulFileCoverageData, V8Coverage } from "./types";

/**
 * Converts a V8 ScriptCoverage object to an Istanbul FileCoverage data object.
 *
 * @param coverage V8 script coverage to convert. It must have the `url` and `function` fields.
 * @param sourceText Source text corresponding to the coverage result.
 */
export function v8ToIstanbul(coverage: V8Coverage, sourceText: string): IstanbulFileCoverageData {
  const covScript = new CovScript(coverage.url, sourceText, coverage.url.startsWith("file://"));
  covScript.applyCoverage(coverage.functions);
  return covScript.toIstanbulFileCoverageData();
}
