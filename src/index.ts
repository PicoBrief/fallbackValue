// ─── Path Types ──────────────────────────────────────────────────────────────

/**
 * Recursively generates all valid dot/bracket notation paths for a given type.
 *
 * Supports:
 *   - Dot notation for object keys:       "user.name"
 *   - Bracket notation for array items:   "users[number].name"
 *   - Escaped dots for literal key names: "a\\.b" (key is literally "a.b")
 *
 * Note: TypeScript template literal types can only express [number] as a whole,
 * not specific indices like [0] or [1]. At runtime, any integer index works correctly.
 */
export type DotPath<T, Prefix extends string = ""> =
    T extends (infer Item)[]
        ? Prefix extends `${infer Base}.`
            ? | `${Base}[${number}]`
            | DotPath<Item, `${Base}[${number}].`>
            : | `${Prefix}[${number}]`
            | DotPath<Item, `${Prefix}[${number}].`>
        : T extends object
            ? {
                [K in keyof T & string]:
                | `${Prefix}${K}`
                | DotPath<T[K], `${Prefix}${K}.`>
            }[keyof T & string]
            : never;

/**
 * Resolves the value type at a given path string within type T.
 *
 * Examples:
 *   PathValue<{ a: { b: string } }, "a.b">          → string
 *   PathValue<{ items: number[] }, "items[number]">  → number
 */
export type PathValue<T, P extends string> =
    P extends `[${number}].${infer Rest}`
        ? T extends (infer Item)[]
            ? PathValue<Item, Rest>
            : never
        : P extends `[${number}]`
            ? T extends (infer Item)[]
                ? Item
                : never
            : P extends `${infer K}[${number}].${infer Rest}`
                ? K extends keyof T
                    ? T[K] extends (infer Item)[]
                        ? PathValue<Item, Rest>
                        : never
                    : never
                : P extends `${infer K}[${number}]`
                    ? K extends keyof T
                        ? T[K] extends (infer Item)[]
                            ? Item
                            : never
                        : never
                    : P extends `${infer K}.${infer Rest}`
                        ? K extends keyof T
                            ? PathValue<T[K], Rest>
                            : never
                        : P extends keyof T
                            ? T[P]
                            : never;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Sentinel to distinguish "key exists with value undefined" from "key not found"
const SENTINEL = Symbol("not-found");

// Keys that must never be accessed — prevents prototype pollution attacks
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Tokenizes a path string into segments, respecting escaped dots.
 *
 * "a.b.c"       → ["a", "b", "c"]
 * "a\\.b.c"     → ["a.b", "c"]      escaped dot = literal dot in key name
 * "a[0].b"      → ["a", "0", "b"]
 * "a\\.b[0].c"  → ["a.b", "0", "c"]
 */
function tokenize(path: string): string[] {
    const segments: string[] = [];
    let current = "";
    let i = 0;

    while (i < path.length) {
        const ch = path[i];

        if (ch === "\\" && path[i + 1] === ".") {
            // Escaped dot — literal dot character in key name
            current += ".";
            i += 2;
        } else if (ch === ".") {
            // Unescaped dot — segment boundary
            if (current) segments.push(current);
            current = "";
            i++;
        } else if (ch === "[") {
            // Bracket notation — flush current key, then read until "]"
            if (current) segments.push(current);
            current = "";
            i++;
            while (i < path.length && path[i] !== "]") {
                current += path[i++];
            }
            if (current) segments.push(current);
            current = "";
            i++; // skip "]"
            if (path[i] === ".") i++; // skip trailing dot e.g. "[0].name"
        } else {
            current += ch;
            i++;
        }
    }

    if (current) segments.push(current);
    return segments;
}

// ─── Overloads ────────────────────────────────────────────────────────────────

/**
 * Overload 1: val is `any` — skip type-safe path resolution entirely.
 * Prevents infinite type instantiation when working with untyped data (e.g. JSON.parse).
 */
export default function fallbackValue(
    val: any,
    path?: string | null,
    defaultVal?: any
): any;

/**
 * Overload 2: No path provided — acts as a nullish coalescing helper.
 * Returns `val` if it is not null/undefined, otherwise returns `defaultVal`.
 */
export default function fallbackValue<T>(
    val: T,
    path?: null,
    defaultVal?: T | null
): T | null;

/**
 * Overload 3: Path provided — safely traverses the object and returns the
 * resolved value, or `defaultVal` if any step along the path is null/undefined.
 */
export default function fallbackValue<T extends object, P extends DotPath<T>>(
    val: T,
    path: P,
    defaultVal?: PathValue<T, P> | null
): PathValue<T, P> | null;

// ─── Implementation ───────────────────────────────────────────────────────────

export default function fallbackValue<T extends object>(
    val: any,
    path?: string | null,
    defaultVal: any = null
): T | null {
    if (path != null) {
        const segments = tokenize(path);
        let current: any = val;

        for (const segment of segments) {
            // Block prototype pollution
            if (UNSAFE_KEYS.has(segment)) return defaultVal;

            // Stop traversal if we hit a non-traversable value
            if (current == null || (typeof current !== "object" && typeof current !== "function")) {
                return defaultVal;
            }

            // Use hasOwnProperty to avoid climbing the prototype chain unexpectedly.
            // Falls back to SENTINEL if the key doesn't exist on the object itself.
            current = Object.prototype.hasOwnProperty.call(current, segment)
                ? current[segment]
                : SENTINEL;

            if (current === SENTINEL) return defaultVal;
        }

        // A resolved `undefined` means the key exists but has no value — return defaultVal.
        return current === undefined ? defaultVal : current;
    }

    return val == null ? defaultVal : val;
}

// ─── Usage Examples ───────────────────────────────────────────────────────────

/*

type Store = {
    users: {
        name: string;
        scores: number[];
        address: { street: string; city: string };
    }[];
};

const store: Store = {
    users: [{ name: "Alice", scores: [10, 20, 30], address: { street: "123 Main St", city: "Springfield" } }],
};

// ✅ Standard paths
fallbackValue(store, "users[0].name", "Anonymous");           // → "Alice"
fallbackValue(store, "users[0].scores[1]", 0);                // → 20
fallbackValue(store, "users[0].address.street", "Unknown");   // → "123 Main St"
fallbackValue(store, "users[1].name", "Anonymous");           // → "Anonymous" (missing index)

// ✅ Escaped dot in key name
const weirdKeys = { "a.b": { c: 42 } };
fallbackValue(weirdKeys, "a\\.b.c", 0);                       // → 42

// ✅ Prototype safety — these are silently blocked
fallbackValue({}, "__proto__.evil", "safe");                   // → "safe"
fallbackValue({}, "constructor", "safe");                      // → "safe"

// ✅ Stored undefined treated as missing
const withUndefined = { a: undefined };
fallbackValue(withUndefined, "a", "default");                  // → "default"

// ✅ No path — nullish coalescing
fallbackValue(null, null, "default");                          // → "default"
fallbackValue("hello", null, "default");                       // → "hello"

// ✅ Untyped data (any) — no infinite type instantiation
let a: any = JSON.parse(`{"fa": {"fb": "vc"}}`);
fallbackValue(a, "fa.fb", "none");                             // → "vc"

// ❌ Invalid path — TypeScript compile error
fallbackValue(store, "users[0].typo");                         // type error ✓

*/
