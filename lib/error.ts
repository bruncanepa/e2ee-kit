const wrapError = (message: string, error: Error): Error => {
  if (!error) {
    return new Error(message);
  }
  try {
    error.message = `${message}: ${error.message}`;
  } catch (e) {}
  return error;
};

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
      throw wrapError(method, error as Error);
    }
  };
}
