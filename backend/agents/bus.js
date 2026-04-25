const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0);

function channel(applicationId) {
  return `app:${applicationId}`;
}

function emit(applicationId, event) {
  bus.emit(channel(applicationId), event);
}

function subscribe(applicationId, listener) {
  const ch = channel(applicationId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

module.exports = { emit, subscribe };
