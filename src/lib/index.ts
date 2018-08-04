import { CovScript } from "./script";

function fromScriptPath(scriptPath: string): CovScript {
  return new CovScript(scriptPath);
}

module.exports = fromScriptPath;

export default fromScriptPath;
