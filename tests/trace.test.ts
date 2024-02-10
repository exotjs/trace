import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tracer } from '../lib/index.js';
import type { Context } from '../lib/types.js';

async function delay(d: number) {
  await new Promise((resolve) => setTimeout(resolve, d));
}

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  describe('.trace()', () => {
    it('should return from the sync function', () => {
      const result = tracer.trace('test', () => {
        return 123;
      });
      expect(result).toEqual(123);
    });

    it('should return from the async function', async () => {
      const result = await tracer.trace('test', async () => {
        await delay(100);
        return 123;
      });
      expect(result).toEqual(123);
    });

    it('should be called with the same context when nested', () => {
      tracer.trace('test1', (ctx1) => {
        tracer.trace('test2', (ctx2) => {
          expect(ctx2 === ctx1).toBeTruthy();
          tracer.trace('test2', (ctx3) => {
            expect(ctx3 === ctx2).toBeTruthy();
          });
        });
      });
    });

    it('should be called with the same context when nested (async)', async () => {
      await tracer.trace('test1', async (ctx1) => {
        await delay(100);
        await tracer.trace('test2', async (ctx2) => {
          expect(ctx2 === ctx1).toBeTruthy();
          await delay(100);
          await tracer.trace('test3', async (ctx3) => {
            expect(ctx3 === ctx2).toBeTruthy();
          });
        });
      });
    });

    it('should not share the same context', () => {
      let ctx1: Context;
      tracer.trace('test1', (ctx) => {
        ctx1 = ctx;
      });
      tracer.trace('test2', (ctx) => {
        expect(ctx1).toBeDefined();
        expect(ctx1 !== ctx).toBeTruthy();
      });
    });

    it('should work with functions outside the scope', () => {
      const fn = vi.fn(() => {
        tracer.trace('test2', () => {
          // noop
        });
      });
      tracer.trace(
        'test1',
        () => {
          fn();
        },
        {
          onEnd(ctx) {
            expect(ctx.rootSpan?.name).toEqual('test1');
            expect(ctx.rootSpan?.children.length).toEqual(1);
            expect(ctx.rootSpan?.children[0].name).toEqual('test2');
          },
        }
      );
      expect(fn).toHaveBeenCalled();
    });

    it('should work with callbacks', async () => {
      const fn = vi.fn((cb: () => void) => {
        delay(100).then(cb);
      });
      await new Promise((resolve) => {
        tracer.trace('test1', (ctx1) => {
          fn(() => {
            tracer.trace('test2', (ctx2) => {
              expect(ctx1 === ctx2).toBeTruthy();
              resolve(void 0);
            });
          });
        });
      });
      expect(fn).toHaveBeenCalled();
    });

    it('should create spans', () => {
      const onEnd = vi.fn((ctx: Context) => {
        expect(ctx.rootSpan?.name).toEqual('test1');
        expect(ctx.rootSpan?.duration).toBeGreaterThan(0);
        expect(ctx.rootSpan?.children.length).toEqual(1);
        expect(ctx.rootSpan?.children[0].name).toEqual('test2');
        expect(ctx.rootSpan?.children[0].duration).toBeGreaterThan(0);
      });
      tracer.trace(
        'test1',
        () => {
          tracer.trace('test2', () => {
            for (let i = 0; i < 1000; i++) {}
          });
        },
        {
          onEnd,
        }
      );
      expect(onEnd).toHaveBeenCalled();
    });

    describe('Attributes', () => {
      it('should add attributes via options', () => {
        const onEnd = vi.fn((ctx: Context) => {
          expect(ctx.rootSpan?.attributes).toEqual({
            attr1: 'a',
            attr2: 'b',
          });
        });
        tracer.trace(
          'test1',
          () => {
            // noop
          },
          {
            attributes: {
              attr1: 'a',
              attr2: 'b',
            },
            onEnd,
          }
        );
        expect(onEnd).toHaveBeenCalled();
      });

      it('should add attributes via context', () => {
        const onEnd = vi.fn((ctx: Context) => {
          expect(ctx.rootSpan?.attributes).toEqual({
            attr1: 'a',
          });
        });
        tracer.trace(
          'test1',
          ({ addAttribute }) => {
            addAttribute('attr1', 'a');
          },
          {
            onEnd,
          }
        );
        expect(onEnd).toHaveBeenCalled();
      });
    });

    describe('Events', () => {
      it('should add an event', () => {
        const onEnd = vi.fn((ctx: Context) => {
          expect(ctx.rootSpan?.events).toEqual([
            {
              time: expect.any(Number),
              text: 'event1',
            },
          ]);
        });
        tracer.trace(
          'test1',
          ({ addEvent }) => {
            addEvent('event1');
          },
          {
            onEnd,
          }
        );
        expect(onEnd).toHaveBeenCalled();
      });

      it('should add an event with attributes', () => {
        const onEnd = vi.fn((ctx: Context) => {
          expect(ctx.rootSpan?.events).toEqual([
            {
              attributes: {
                attr1: 'a',
              },
              time: expect.any(Number),
              text: 'event1',
            },
          ]);
        });
        tracer.trace(
          'test1',
          ({ addEvent }) => {
            addEvent('event1', {
              attr1: 'a',
            });
          },
          {
            onEnd,
          }
        );
        expect(onEnd).toHaveBeenCalled();
      });
    });
  });

  describe('.getActiveSpan()', () => {
    it('should return the current span', () => {
      const fn = vi.fn(() => {
        const span = tracer.getActiveSpan();
        expect(span).toBeDefined();
        expect(span?.duration).toEqual(0);
        expect(span?.name).toEqual('test');
      });
      tracer.trace('test', () => {
        fn();
      });
      expect(fn).toHaveBeenCalled();
    });
  });
});
