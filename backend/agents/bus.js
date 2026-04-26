const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0);

function channel(applicationId) {
  return `app:${applicationId}`;
}

function offerChannel(negotiationId) {
  return `offer:${negotiationId}`;
}

function emit(applicationId, event) {
  bus.emit(channel(applicationId), event);
}

function emitOffer(negotiationId, event) {
  bus.emit(offerChannel(negotiationId), event);
}

function subscribe(applicationId, listener) {
  const ch = channel(applicationId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

function subscribeOffer(negotiationId, listener) {
  const ch = offerChannel(negotiationId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

module.exports = { emit, subscribe, emitOffer, subscribeOffer };
