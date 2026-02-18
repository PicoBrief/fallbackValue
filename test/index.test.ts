import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fallbackValue from "../src/index.ts";

// ─── No path — nullish coalescing ─────────────────────────────────────────────

describe("no path", () => {
    test("returns the value when it is not null or undefined", () => {
        assert.equal(fallbackValue("hello", null, "default"), "hello");
        assert.equal(fallbackValue(0, null, 99), 0);
        assert.equal(fallbackValue(false, null, true), false);
        assert.equal(fallbackValue("", null, "fallback"), "");
    });

    test("returns defaultVal when val is null", () => {
        assert.equal(fallbackValue(null, null, "default"), "default");
    });

    test("returns defaultVal when val is undefined", () => {
        assert.equal(fallbackValue(undefined, null, "default"), "default");
    });

    test("defaults to null when no defaultVal is provided", () => {
        assert.equal(fallbackValue(null), null);
        assert.equal(fallbackValue(undefined), null);
    });
});

// ─── Dot notation ─────────────────────────────────────────────────────────────

describe("dot notation", () => {
    test("reads a top-level key", () => {
        assert.equal(fallbackValue({ name: "Alice" }, "name", "Unknown"), "Alice");
    });

    test("reads a deeply nested key", () => {
        assert.equal(fallbackValue({ a: { b: { c: 42 } } } as any, "a.b.c", 0), 42);
    });

    test("returns defaultVal for a missing top-level key", () => {
        assert.equal(fallbackValue({ a: 1 } as any, "b", "missing"), "missing");
    });

    test("returns defaultVal when an intermediate key is missing", () => {
        assert.equal(fallbackValue({ a: {} } as any, "a.b.c", "nope"), "nope");
    });

    test("returns null by default when the path leads nowhere", () => {
        assert.equal(fallbackValue({ a: 1 } as any, "b"), null);
    });
});

// ─── Bracket notation ─────────────────────────────────────────────────────────

describe("bracket notation", () => {
    test("reads an array item by index", () => {
        assert.equal(fallbackValue({ nums: [10, 20, 30] }, "nums[1]", 0), 20);
    });

    test("reads the first and last items in an array", () => {
        assert.equal(fallbackValue({ nums: [10, 20, 30] }, "nums[0]", 0), 10);
        assert.equal(fallbackValue({ nums: [10, 20, 30] }, "nums[2]", 0), 30);
    });

    test("reads a nested property of an array item", () => {
        const data = { users: [{ name: "Alice" }, { name: "Bob" }] };
        assert.equal(fallbackValue(data, "users[0].name", "Unknown"), "Alice");
        assert.equal(fallbackValue(data, "users[1].name", "Unknown"), "Bob");
    });

    test("returns defaultVal for an out-of-bounds index", () => {
        assert.equal(fallbackValue({ items: [1, 2] }, "items[9]", -1), -1);
    });

    test("returns defaultVal when an array item is missing a property", () => {
        const data = { users: [{ name: "Alice" }, {}] } as any;
        assert.equal(fallbackValue(data, "users[1].name", "Unknown"), "Unknown");
    });

    test("handles nested arrays", () => {
        const data = { matrix: [[1, 2], [3, 4]] };
        assert.equal(fallbackValue(data, "matrix[0][1]", 0), 2);
        assert.equal(fallbackValue(data, "matrix[1][0]", 0), 3);
    });
});

// ─── Escaped dots ─────────────────────────────────────────────────────────────

describe("escaped dots in key names", () => {
    test("reads a key that contains a literal dot", () => {
        const obj = { "first.name": "Alice" } as any;
        assert.equal(fallbackValue(obj, "first\\.name", "Unknown"), "Alice");
    });

    test("reads a nested path with an escaped dot segment", () => {
        const obj = { "a.b": { c: 42 } } as any;
        assert.equal(fallbackValue(obj, "a\\.b.c", 0), 42);
    });

    test("treats an unescaped dot as a path separator (not a literal dot)", () => {
        const obj = { "first.name": "Alice" } as any;
        // "first.name" without escape → looks for obj.first.name → missing
        assert.equal(fallbackValue(obj, "first.name", "Unknown"), "Unknown");
    });
});

// ─── Prototype pollution protection ───────────────────────────────────────────

describe("prototype pollution protection", () => {
    test("blocks __proto__", () => {
        assert.equal(fallbackValue({} as any, "__proto__.evil", "safe"), "safe");
    });

    test("blocks constructor", () => {
        assert.equal(fallbackValue({} as any, "constructor", "safe"), "safe");
    });

    test("blocks prototype", () => {
        assert.equal(fallbackValue({} as any, "prototype", "safe"), "safe");
    });

    test("blocks an unsafe key nested inside a valid path", () => {
        assert.equal(fallbackValue({ a: {} } as any, "a.__proto__", "safe"), "safe");
    });

    test("does not pollute Object.prototype", () => {
        fallbackValue({} as any, "__proto__.injected", "x");
        assert.equal((Object.prototype as any).injected, undefined);
    });
});

// ─── Stored undefined ─────────────────────────────────────────────────────────

describe("stored undefined", () => {
    test("treats a key with value undefined as missing", () => {
        const obj = { score: undefined } as any;
        assert.equal(fallbackValue(obj, "score", 0), 0);
    });

    test("returns null (not undefined) when stored undefined has no defaultVal", () => {
        const obj = { score: undefined } as any;
        assert.equal(fallbackValue(obj, "score"), null);
    });

    test("returns stored null as-is (null is not treated as missing)", () => {
        const obj = { value: null } as any;
        assert.equal(fallbackValue(obj, "value", "default"), null);
    });
});

// ─── Non-traversable intermediates ────────────────────────────────────────────

describe("non-traversable intermediates", () => {
    test("returns defaultVal when an intermediate is a string", () => {
        assert.equal(fallbackValue({ a: "not-an-object" } as any, "a.b", "nope"), "nope");
    });

    test("returns defaultVal when an intermediate is a number", () => {
        assert.equal(fallbackValue({ a: 42 } as any, "a.b", "nope"), "nope");
    });

    test("returns defaultVal when an intermediate is null", () => {
        assert.equal(fallbackValue({ a: null } as any, "a.b", "nope"), "nope");
    });

    test("returns defaultVal when an intermediate is undefined", () => {
        assert.equal(fallbackValue({ a: undefined } as any, "a.b", "nope"), "nope");
    });
});

// ─── Untyped (any) data ───────────────────────────────────────────────────────

describe("untyped (any) data", () => {
    test("works with JSON.parse output", () => {
        const data: any = JSON.parse('{"settings":{"theme":"dark"}}');
        assert.equal(fallbackValue(data, "settings.theme", "light"), "dark");
        assert.equal(fallbackValue(data, "settings.font", "Arial"), "Arial");
    });

    test("returns defaultVal for a path that does not exist in parsed JSON", () => {
        const data: any = JSON.parse('{"a":1}');
        assert.equal(fallbackValue(data, "b.c.d", "missing"), "missing");
    });
});
