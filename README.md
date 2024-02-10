# Exot Trace

Exot Trace is a small, performant library simplifying application tracing. Utilizing [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage), this library simplifies tracing function calls by integrating the `trace()` function directly into your codebase without the need to manage context manually.

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

async function getUser(id: string) {
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
  "attributes": {},
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
  "events": [],
  "name": "router:getUser",
  "start": 1707548525703.1785,
  "uuid": "12652d90-c01e-48c7-ae2a-7984033b515e"
}
```

## How It Works

The `trace(name, fn)` function executes the `fn` function and returns its return value. The start time of the execution and the duration are automatically tracked and stored into a "span".

Nested `trace()` calls work out-of-the-box without the need to pass around any context or parent span, thanks to Node's [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) from the `node:async_hooks` module. This feature allows you to track nested executions and construct a tree of trace spans.

To store traces in OpenTelemetry or a database, use the `createSpan` and `endSpan` [events](#events).

## Performance

```
- baseline (no tracing)...................  6,402,783 ops/s ±1.06%
- tracing inactive........................  6,392,829 ops/s ±0.74%
- tracing active..........................  1,414,287 ops/s ±0.69%
```

Using the `trace()` function in your code with tracing enabled incurs a significant performance penalty (approximately ~80% according to the benchmark). However, when tracing is deactivated using the `active` property, the penalty is negligible. Thus, it's acceptable to keep `trace()` functions in your production code and enable tracing only when needed.

## Compatibility

- Node.js 16+
- Bun 1+

## Using `trace(name, fn, options?)`

The `trace()` function executes the `fn` function and returns its return value. The `fn` function receives one argument, the [context](#context).

Parameters:

- `name: string` (required) Descriptive trace name.
- `fn: (ctx: Context) => any` (required) The function to be traced. Can be synchronous or asynchronous.
- `options?: SpanOptions` See below.

Returns the return value of the `fn` function.

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

## Events

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

- `span: Span` The span instance.
- `name: string` The name of the attribute.
- `value: unknown` The value of the attribute.

### `addEvent`

Triggered when a new event has been added to a span.

Arguments:

- `span: Span` The span instance.
- `text: string` The text of the event.
- `attributes: Record<string, unknown>` Optional attributes of the event.

### `startSpan`

Triggered when a new span has started.

Arguments:

- `span: Span` The span instance.

### `endSpan`

Triggered when a span has ended.

Arguments:

- `span: Span` The span instance.

## License

MIT