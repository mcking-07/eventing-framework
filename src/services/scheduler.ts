import { loggerFor, safe } from '../common';
import type { SchedulerConfig, TaskType } from '../types';

const logger = loggerFor(import.meta.url);

class TaskScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private readonly interval: number;
  constructor({ interval }: SchedulerConfig) {
    logger.info(`[~] initializing task scheduler with interval [${interval}] ms`);
    this.interval = interval;
  }

  public schedule(name: string, task: TaskType): void {
    logger.info(`[~] scheduling task [${name}] to run every [${this.interval}] ms`);
    this.timer = setInterval(() => void safe(task)(), this.interval);
  }

  public stop(): void {
    logger.info('[~] stopping any scheduled tasks');
    if (this.timer) clearInterval(this.timer);
  }
}

export { TaskScheduler };
