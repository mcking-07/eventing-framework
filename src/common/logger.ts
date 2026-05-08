import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Logger, createLogger, format, transports } from 'winston';

const { combine, colorize, uncolorize, label, printf, splat, timestamp } = format;
const { Console } = transports;

const colors = process.env.NODE_ENV !== 'production';
const formatter = printf(({ timestamp, label, level, message, ...meta }) => `[${timestamp}] [${label}] [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`);

const loggerFor = (filename: string, level: string = 'debug'): Logger => {
  const path = fileURLToPath(filename).split(sep).slice(-3).join(sep);
  const format = combine(label({ label: path }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), splat(), colors ? colorize() : uncolorize(), formatter);

  return createLogger({ format, level, transports: [new Console({ format })] });
};

export { loggerFor };
