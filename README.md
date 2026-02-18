# fallbackValue

A safe, fully typed utility for reading deeply nested values from objects — without crashing when something along the way is missing.

`fallbackValue` knows the shape of your data at compile time, which means TypeScript will warn you if you mistype a path, and will automatically know what type the returned value is — no guessing required.

---

## The problem it solves

Imagine you have data that looks like this:

```typescript
const user = {
    profile: {
        address: {
            city: "Springfield"
        }
    }
};
```

To read `city`, you'd normally write:

```typescript
const city = user.profile.address.city;
```

But what if `profile` or `address` doesn't exist? JavaScript throws an error:

```
TypeError: Cannot read properties of undefined (reading 'city')
```

You could guard against this manually:

```typescript
const city = user.profile && user.profile.address && user.profile.address.city;
```

But that gets messy fast. `fallbackValue` handles all of this for you in one clean call:

```typescript
fallbackValue(user, "profile.address.city", "Unknown");
// → "Springfield" if it exists, "Unknown" if anything is missing
```

And because it's fully typed, TypeScript knows the result is a `string` — so you get autocompletion and a compile-time error if you ever mistype the path:

```typescript
fallbackValue(user, "profile.address.city", "Unknown");  // ✅ TypeScript knows this returns a string
fallbackValue(user, "profile.address.typo", "Unknown");  // ❌ TypeScript error — "typo" is not a valid path
```

---

## Installation

```bash
npm install @pico-brief/fallbackValue
```

Then import it:

```typescript
import fallbackValue from "@pico-brief/fallbackValue";
```

---

## Basic usage

```typescript
fallbackValue(object, path, defaultValue)
```

| Parameter      | What it is                                              |
|----------------|---------------------------------------------------------|
| `object`       | The object you want to read from                        |
| `path`         | A string describing where to look (see Path Syntax)     |
| `defaultValue` | What to return if the path leads nowhere (default: `null`) |

---

## Path syntax

Paths are just strings that describe how to navigate into an object.

### Dot notation — for regular object properties

```typescript
fallbackValue(data, "user.name", "Anonymous")
//                   ─────┬────
//                        └─ reads data.user.name
```

### Bracket notation — for arrays

```typescript
fallbackValue(data, "users[0].name", "Anonymous")
//                        ─┬─
//                         └─ reads the first item in the users array
```

### Combining both

```typescript
fallbackValue(data, "company.employees[2].email", "N/A")
// reads: data → company → employees → item at index 2 → email
```

---

## Examples

### Simple object

```typescript
const person = { name: "Alice", age: 30 };

fallbackValue(person, "name", "Unknown");   // → "Alice"
fallbackValue(person, "email", "No email"); // → "No email" (key doesn't exist)
```

### Nested object

```typescript
const config = {
    database: {
        host: "localhost",
        port: 5432
    }
};

fallbackValue(config, "database.host", "127.0.0.1"); // → "localhost"
fallbackValue(config, "database.user", "root");      // → "root" (missing)
```

### Arrays

```typescript
const data = {
    scores: [10, 20, 30]
};

fallbackValue(data, "scores[0]", 0); // → 10
fallbackValue(data, "scores[9]", 0); // → 0 (index out of bounds)
```

### Arrays of objects

```typescript
const store = {
    users: [
        { name: "Alice", address: { city: "Springfield" } },
        { name: "Bob" }
    ]
};

fallbackValue(store, "users[0].address.city", "Unknown"); // → "Springfield"
fallbackValue(store, "users[1].address.city", "Unknown"); // → "Unknown" (Bob has no address)
fallbackValue(store, "users[5].name", "Unknown");         // → "Unknown" (index 5 doesn't exist)
```

### Without a path — simple null safety

You can also use `fallbackValue` without a path, just to safely handle `null` or `undefined` values:

```typescript
let username = null;

fallbackValue(username, null, "Guest"); // → "Guest"
```

### With untyped data (e.g. from JSON.parse)

```typescript
const raw: any = JSON.parse('{"settings": {"theme": "dark"}}');

fallbackValue(raw, "settings.theme", "light"); // → "dark"
fallbackValue(raw, "settings.font", "Arial");  // → "Arial" (missing)
```

---

## Edge cases handled

### Key names that contain a dot

If your data has a key that literally contains a dot (e.g. `"first.name"`), escape it with a backslash:

```typescript
const weird = { "first.name": "Alice" };

fallbackValue(weird, "first\\.name", "Unknown"); // → "Alice"
//                         ──┬──
//                           └─ backslash tells fallbackValue this dot is part of the key name
```

Without the backslash, `"first.name"` would be read as two separate keys: `first` → `name`.

### Stored `undefined` is treated as missing

```typescript
const obj = { score: undefined };

fallbackValue(obj, "score", 0); // → 0
```

Even though `score` exists as a key, its value is `undefined`, which `fallbackValue` treats the same as missing.

---

## TypeScript support

If you're using TypeScript, `fallbackValue` will catch typos in your paths at compile time:

```typescript
type User = { name: string; age: number };
const user: User = { name: "Alice", age: 30 };

fallbackValue(user, "name", "Unknown");  // ✅ works
fallbackValue(user, "typo", "Unknown"); // ❌ TypeScript error — "typo" is not a valid path
```

It also knows what type the result will be, so you get proper autocompletion:

```typescript
const name = fallbackValue(user, "name", "Unknown");
//    ^^^^
//    TypeScript knows this is a `string`
```

---

## Quick reference

```typescript
// Read a nested value with a fallback
fallbackValue(obj, "a.b.c", "default")

// Read from an array
fallbackValue(obj, "items[0].name", "default")

// Mix of both
fallbackValue(obj, "users[2].address.city", "Unknown")

// Escaped dot in key name
fallbackValue(obj, "some\\.key.nested", "default")

// No path — null safety only
fallbackValue(value, null, "default")

// Untyped data
fallbackValue(anyValue, "path.to.something", "default")
```
