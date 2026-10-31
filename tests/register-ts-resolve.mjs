// Test-only resolve hook: lets Node's native TypeScript runner resolve the
// extension-free imports used by Next.js app code (e.g. "./members" -> "./members.ts").
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (err) {
          const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
          if (err?.code === "ERR_MODULE_NOT_FOUND" && isRelative && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
            return next(specifier + ".ts", context);
          }
          throw err;
        }
      }
    `),
  import.meta.url
);
