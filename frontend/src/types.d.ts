/// <reference types="vite/client" />

declare module 'quagga' {
  const Quagga: unknown;
  export default Quagga;
}

declare module 'papaparse' {
  export interface ParseResult<T> {
    data: T[];
  }

  export interface ParseConfig<T> {
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
    header?: boolean;
    skipEmptyLines?: boolean;
  }

  const Papa: {
    parse<T>(file: File, config: ParseConfig<T>): void;
  };

  export default Papa;
}
