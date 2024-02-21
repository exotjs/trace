import {
  assertEquals,
  assertGreater,
} from 'https://deno.land/std@0.213.0/assert/mod.ts';
import { Tracer } from '../deno_dist/index.ts';

/**
 * Run the tests with --allow-hrtime to get precise times
 */

Deno.test('Tracer', async (t) => {
  const tracer = new Tracer();

  await t.step('should create a new span', () => {
    const span = tracer.startSpan('test');
    assertEquals(span.name, 'test');
    assertEquals(span.duration, 0);
  });

  await t.step("should end a span and set span's duration", () => {
    const span = tracer.startSpan('test');
    tracer.endSpan(span);
    assertEquals(span.name, 'test');
    assertGreater(span.duration, 0);
  });

  await t.step('should trace nested calls', () => {
    tracer.trace('test1', (ctx) => {
      tracer.trace('test2', () => void 0);
      assertEquals(ctx.rootSpan.children.length, 1);
      assertEquals(ctx.rootSpan.children[0].name, 'test2');
    });
  });

  await t.step(
    'should trace nested async calls in a named function',
    async () => {
      function test() {
        return tracer.trace(
          'test2',
          () =>
            new Promise((resolve) => {
              resolve(void 0);
            })
        );
      }
      await tracer.trace('test1', async (ctx) => {
        await test();
        assertEquals(ctx.rootSpan.children.length, 1);
        assertEquals(ctx.rootSpan.children[0].name, 'test2');
      });
    }
  );
});
