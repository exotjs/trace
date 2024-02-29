# Exot Trace

Exot Trace is a small, performant library simplifying application tracing. Utilizing [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage), this library simplifies tracing function calls by integrating the `trace()` function directly into your codebase without the need to manage context manually.

[![ci](https://github.com/exotjs/trace/actions/workflows/ci.yml/badge.svg)](https://github.com/exotjs/trace/actions/workflows/ci.yml)

## Install

```sh
npm install @exotjs/trace
```

## Deno

```ts
import { Tracer } from 'https://deno.land/x/exot_trace/mod.ts'
```

## Usage

```ts
import { Tracer } from '@exotjs/trace';

const tracer = new Tracer();
const { trace } = tracer;

tracer.on('endSpan', (span) => {
  if (!span.parent) {
    // Print only if it's a span without a parent
    console.log(JSON.stringify(span, null, '  '));
  }
});

async function getUser(id) {
  // This trace will be automatically grouped with router:getUser
  return trace('prisma:getUser', () => prisma.users.findUnique({
    where: {
      id,
    },
  }));
}

app.get('/user/:id', (req) => {
  // Use the `trace()` function in your code:
  trace('router:getUser', async () => {
    return {
      user: await getUser(req.params.id),
    };
  });
});
```

After execution, the console will print the following traces:

```json
{
  "attributes": {
    "http:method": "GET",
    "http:path": "/hello-world",
  },
  "children": [
    {
      "attributes": {},
      "children": [],
      "duration": 6.110107421875,
      "events": [],
      "name": "prisma:getUser",
      "start": 1707548525703.3647
    }
  ],
  "duration": 6.533447265625,
  "events": [{
    "attributes": {
      "level": "debug"
    },
    "text": "log text...",
    "time": 1707548525703.3647
  }],
  "name": "router:getUser",
  "start": 1707548525703.1785,
  "uuid": "12652d90-c01e-48c7-ae2a-7984033b515e"
}
```

## How It Works

The `trace(name, fn)` function executes the `fn` function and returns its return value. The start time of the execution and the duration are automatically tracked and stored into a "span".

Nested `trace()` calls work out-of-the-box without the need to pass around any context or parent span, thanks to Node's [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) from the `node:async_hooks` module. This feature allows you to track nested executions and construct a tree of trace spans.

To store traces in OpenTelemetry or a database, use the `createSpan` and `endSpan` [events](#events).

## Active vs. Inactive Tracing

To gain some extra performance when tracing isn't actively being monitored, the `Tracer` exposes the `active` property. When set to `false`, it disables some features while keeping the `trace()`, `startSpan()`, and `endSpan()` functions working as normal.

This allows you to keep `trace()` functions in your production codebase and only activate the tracer when needed.

This table shows which functions and features are affected:

| Feature       | Active | Inactive |
|---------------|--------|----------|
| trace()       | Yes    | Yes      |
| startSpan()   | Yes    | Yes      |
| endSpan()     | Yes    | Yes      |
| addAttribute()| Yes    | No       |
| addEvent()    | Yes    | No       |
| setStatus()   | Yes    | No       |
| Duration      | Yes    | Yes      |
| Parent detection | Yes | No       |

## Performance

```
trace()

- baseline (no tracing)...................  6,906,999 ops/s ±1.05%
- tracing inactive........................  2,906,365 ops/s ±0.63%
- tracing active..........................  1,020,008 ops/s ±0.90%
```

```
startSpan() + endSpan()

- baseline (no tracing)...................  6,933,248 ops/s ±1.06%
- tracing inactive........................  3,663,070 ops/s ±0.52%
- tracing active..........................  1,756,365 ops/s ±0.68%
```

The benchmark above shows the number of executions per second of a noop function in three scenarios - (1) no tracing at all, (2) with tracing implemented but disabled, and (3) tracing implemented and enabled. Tracing incurs a significant performance penalty, but even with active tracing, you should reach over 1M ops/sec.

For benchmarks run with a HTTP server, refer to the [Hono integration benchmarks](https://github.com/exotjs/hono?tab=readme-ov-file#performance).


See [/benchmarks](/benchmarks) folder.

## Compatibility

This library is meant to be used only server-side and is compatible with the latest versions of Node.js, Bun and Deno.

- Node.js 16+
- Bun 1+
- Deno 1+

### Deno

When using with Deno, execute your application with `--allow-hrtime` to allow high-precision time tracking.

## Using `trace()`

The `trace()` function executes the `fn` function and returns its return value. The `fn` function receives one argument, the [context](#context).

Parameters:

- `name: string` (required) Descriptive trace name.
- `fn: (ctx: Context) => any` (required) The function to be traced. Can be synchronous or asynchronous.
- `options?: SpanOptions` [See below](#spanoptions).

Returns the return value of the `fn` function.

## Using `startSpan()` and `endSpan()`

An alternative to the `trace()` function is to use functions `startSpan()` and `endSpan()`:

```ts
const span = tracer.startSpan('myspan');
// Your code here...
tracer.endSpan(span);

console.log('Duration:', span.duration);
```

These functions do not automatically carry context; to nest spans together, you have to provide the parent span using the `options` parameter.

### `startSpan(name, options?)`

Parameters:

- `name: string` (required) Descriptive trace name.
- `options?: SpanOptions` [See below](#spanoptions).

### `endSpan(span)`

Parameters:

- `span: TraceSpan` (required) Span to end.

## Context

```ts
trace('mytrace', (ctx) => {
  // add custom attributes to the current span
  ctx.addAttribute('custom-attribute', 'some value');

  // add custom events to the current span
  ctx.addEvent('some-event', {
    attr1: 'abc',
  });

  // terminate the current span
  ctx.end();
})
```

### `ctx.name: string`

The name of the root span.

### `ctx.addAttribute(name, value)`

Adds a custom attribute to the current span.

### `ctx.addEvent(text, attributes?)`

Adds a custom event with optional attributes to the current span.

### `ctx.end()`

Terminates the current span.

### `ctx.setStatus(status, attributes?)`

Sets the status (`ok` or `error`) of the current span.

## Span

The `TraceSpan` has the following structure:

```ts
interface TraceSpan {
  attributes: Record<string, unknown>;
  children: TraceSpan[];
  duration: number;
  events: {
    attributes?: Record<string, unknown>;
    time: number;
    text: string;
  }[];
  name: string;
  parent?: TraceSpan;
  start: number;
  status?: TraceSpanStatus;
  uuid?: string;
}

enum TraceSpanStatus {
  ERROR = 'error',
  OK = 'ok',
}
```

The `uuid` property is set only for the "root spans" (which don't a parent span) and you can use these UUIDs (v4) as "trace ID".

## SpanOptions

```ts
interface SpanOptions {
  attributes?: Attributes;
  parent?: TraceSpan;
}
```

The `trace()` function also accepts `onEnd` function, which gets called once the snap has ended:

```ts
interface TraceOptions extends SpanOptions {
  onEnd?: (ctx: TraceContext) => void;
}
```

## Events

> [!IMPORTANT]  
> Events are emitted only when the tracer is [`active`](#active-vs-inactive-tracing).

```ts
import { Tracer } from '@exotjs/trace';

const tracer = new Tracer();

tracer.on('startSpan', (span) => {
  // your implementation here...
});
```

### `addAttribute`

Triggered when a new attribute has been assigned to a span.

Arguments:

- `span: TraceSpan` The span instance.
- `name: string` The name of the attribute.
- `value: unknown` The value of the attribute.

### `addEvent`

Triggered when a new event has been added to a span.

Arguments:

- `span: TraceSpan` The span instance.
- `text: string` The text of the event.
- `attributes: Record<string, unknown>` Optional attributes of the event.

### `startSpan`

Triggered when a new span has started.

Arguments:

- `span: TraceSpan` The span instance.

### `endSpan`

Triggered when a span has ended.

Arguments:

- `span: TraceSpan` The span instance.

### `setStatus`

Triggered when the span's status is set.

Arguments:

- `span: TraceSpan` The span instance.
- `status: TraceSpanStatus` The status of the span.
- `attributes: Record<string, unknown>` Optional attributes of the event.

## License

MIT