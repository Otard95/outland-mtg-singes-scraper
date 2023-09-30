import { createWriteStream } from 'node:fs';

type ErrorLogger = {
  (...args: string[]): void;
  end(): void;
};

interface ErrorLoggerOptions {
  linePrefix?: string;
  EOL?: string;
}

const defaultOptions: ErrorLoggerOptions = {
  linePrefix: '',
  EOL: '\n',
};

export function createFileLogger(
  file = 'error.log',
  options?: ErrorLoggerOptions
) {
  const stream = createWriteStream(file, { flags: 'a' });

  const { linePrefix, EOL } = { ...defaultOptions, ...(options || {}) };

  const logger: ErrorLogger = (...args: string[]) => {
    stream.write(`${linePrefix}${args.join('\t')}${EOL}`);
  };
  logger.end = () => {
    stream.end();
  };

  return logger;
}
