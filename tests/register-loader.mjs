import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const path = new URL("./ts-resolve-loader.mjs", import.meta.url);
register(path);
