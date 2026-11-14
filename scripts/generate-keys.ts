// Prints fresh values for ENCRYPTION_KEYS and LOOKUP_KEY.
import { randomBytes } from "node:crypto";

const key = () => randomBytes(32).toString("base64");
console.log(`ENCRYPTION_KEYS='${JSON.stringify({ "1": key() })}'`);
console.log("ENCRYPTION_ACTIVE_KEY_VERSION=1");
console.log(`LOOKUP_KEY=${key()}`);
