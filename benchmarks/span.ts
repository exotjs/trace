import { benchmark } from './helpers.js';
import { Tracer } from '../lib/index.js';

const tracer = new Tracer();
const { endSpan, startSpan } = tracer;

function fn() {
  // noop
}

await benchmark('startSpan() + endSpan()', (bench) => {
  bench
    .add('baseline (no tracing)', async () => {
      fn();
    })
    .add('tracing inactive', async () => {
      const span = startSpan('test');
      fn();
      endSpan(span);
    }, {
      beforeAll() {
        tracer.active = false;
      },
    })
    .add('tracing active', async () => {
      const span = startSpan('test');
      fn();
      endSpan(span);
    }, {
      beforeAll() {
        tracer.active = true;
      },
    })
});

