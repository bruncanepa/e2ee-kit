export class OpenE2EEError extends Error {
  constructor(method: string, error: Error) {
    const message = `${method}: ${error.message}`;
    super(message);
    this.message = message
    this.name = error.name;
    this.stack = error.stack;
  }
}

/**
 * Generic function that accepts any number of parameters.
 */
type GenericFunction = (...args: any[]) => any;

/**
 * Can be used to wrap a function within a function with the
 * same signature.
 * @param F - Function that should be wrapped.
 */
type TryCatch<F extends GenericFunction> = (
  ...args: Parameters<F>
) => Promise<ReturnType<F>>;

type TryCatchSync<F extends GenericFunction> = (
  ...args: Parameters<F>
) => ReturnType<F>;

/**
 * Wraps an function that returns a Promise within a try/catch block to map any third-party error
 * @param method method name to add to message to identify the broken function
 * @param func function that should be wrapped.
 */
export function tryCatch<F extends GenericFunction>(
  method: string,
  func: F
): TryCatch<F> {
  return async (...args) => {
    try {
      return await func(...args);
    } catch (error) {
      throw new OpenE2EEError(method, error as Error);
    }
  };
}

/**
 * Wraps a function that doesn't return a Promise within a try/catch block to map any third-party error
 * @param method method name to add to message to identify the broken function
 * @param func function that should be wrapped.
 */
export function tryCatchSync<F extends GenericFunction>(
  method: string,
  func: F
): TryCatchSync<F> {
  return (...args) => {
    try {
      return func(...args);
    } catch (error) {
      throw new OpenE2EEError(method, error as Error);
    }
  };
}
