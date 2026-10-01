// Lets `node --test` load modules written for the Next.js bundler: maps the
// "@/" path alias to src/ and retries extensionless imports with .ts, .js and
// /index.ts. Used by `npm test` only; the app build does not load it.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
const SUFFIXES = [".ts", ".js", "/index.ts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? SRC + specifier.slice(2) : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw error;
      for (const suffix of SUFFIXES) {
        try {
          return nextResolve(target + suffix, context);
        } catch {
          // try the next suffix
        }
      }
      throw error;
    }
  },
});
