import type { ErrorPayload } from '../types';

class EventingError extends Error {
  constructor(message: string, public payload: ErrorPayload = {}) {
    super(message);
    this.name = this.constructor.name;
    this.payload = payload;
  }
}

class EventAlreadyRegistered extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class TopicConfigUndefined extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class QueueConfigUndefined extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class SchedulerConfigUndefined extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class StorageConfigUndefined extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class StorageReferenceUndefined extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

class EmptyResponseFromStore extends EventingError {
  constructor(message: string, payload: ErrorPayload = {}) {
    super(message, payload);
  }
}

export {
  EventingError, EventAlreadyRegistered, TopicConfigUndefined, QueueConfigUndefined, SchedulerConfigUndefined, StorageConfigUndefined, StorageReferenceUndefined, EmptyResponseFromStore,
};