import Protocol from "devtools-protocol";
import { CovScript } from "./script";
import { IstanbulFileCoverageData } from "./types";

module.exports = fromScriptUrlSync;

/**
 * Converts a V8 ScriptCoverage object to an Istanbul FileCoverage data object.
 *
 * If you provide a `sourceText`, it is used as source text corresponding to
 * the coverage result.
 * If you do not provide the source text, it will try to read it from disk
 * using the `url` property as the path. File resolution is handled by Node:
 * for example, relative path are resolved from `process.cwd()`.
 *
 * @param v8ScriptCoverage V8 script coverage result to convert.
 * @param sourceText Source text corresponding to the coverage result. Read from
 *     from disk if not provided.
 */
export async function fromScriptCoverage(
  v8ScriptCoverage: Protocol.Profiler.ScriptCoverage,
  sourceText?: string,
): Promise<IstanbulFileCoverageData> {
  const covScript = await CovScript.fromUrl(v8ScriptCoverage.url);
  covScript.applyCoverage(v8ScriptCoverage.functions);
  return covScript.toIstanbulFileCoverageData();
}

export async function fromScriptUrl(scriptPath: string): Promise<CovScript> {
  return CovScript.fromUrl(scriptPath);
}

export function fromScriptUrlSync(scriptPath: string): CovScript {
  return CovScript.fromUrlSync(scriptPath);
}

export default fromScriptUrlSync;
