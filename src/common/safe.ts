import { safe as wrapper } from 'safe-wrapper';
import { loggerFor } from './logger';

const logger = loggerFor(import.meta.url);

const { env: { NODE_ENV } = {} } = process;

const default_transformer = (error: Error) => {
  if (NODE_ENV !== 'test') logger.error('[!] safe: an error occurred:', error);
  return error;
};

const safe = <ActionType extends (...args: Parameters<ActionType>) => ReturnType<ActionType>>(action: ActionType, types = [], transformer = default_transformer) => wrapper(action, types, transformer);

export { safe };
