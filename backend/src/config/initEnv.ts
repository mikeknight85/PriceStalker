/**
 * Side-effect import that guarantees `.env` is loaded by `dotenv` before
 * any subsequent application imports are evaluated.
 *
 * ES module static imports are hoisted and executed before procedural body code
 * in entry points like `index.ts`. Importing this first prevents module-level
 * `process.env` constants (such as `LOG_DIR_PATH` in printer.ts or `PORT`) from
 * binding to undefined or fallback defaults before `.env` is parsed.
 */
import { loadEnvironment } from './environment';

loadEnvironment();
