const results = [];

function logResult(result) {
  results.push(result);
}

global.describe = (name, fn) => {
  logResult({ type: 'suite', name });
  fn();
};

global.it = (name, fn) => {
  try {
    const maybePromise = fn();
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise
        .then(() => logResult({ type: 'test', name, status: 'passed' }))
        .catch((error) => logResult({ type: 'test', name, status: 'failed', error }));
    }
    logResult({ type: 'test', name, status: 'passed' });
  } catch (error) {
    logResult({ type: 'test', name, status: 'failed', error });
  }
};

global.expect = (received) => ({
  toBeCloseTo(expected, precision = 2) {
    const pass = Math.abs(received - expected) < Math.pow(10, -precision) * 5;
    if (!pass) {
      throw new Error(`Expected ${received} to be close to ${expected}`);
    }
  },
  toEqual(expected) {
    const pass = JSON.stringify(received) === JSON.stringify(expected);
    if (!pass) {
      throw new Error(`Expected ${JSON.stringify(received)} to equal ${JSON.stringify(expected)}`);
    }
  },
});

async function run() {
  await import('../tests/calculations.test.js');
  const failed = results.filter((r) => r.type === 'test' && r.status === 'failed');
  results.forEach((result) => {
    if (result.type === 'suite') {
      console.log(`\n${result.name}`);
    } else {
      const status = result.status === 'passed' ? '✓' : '✗';
      console.log(` ${status} ${result.name}`);
      if (result.error) {
        console.error(result.error.stack || result.error.message);
      }
    }
  });
  if (failed.length) {
    process.exitCode = 1;
  } else {
    console.log('\nAll tests passed.');
  }
}

run();
