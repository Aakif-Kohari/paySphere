'use strict';
class BaseProvider {
  constructor() {
    if (new.target === BaseProvider) throw new TypeError('BaseProvider is abstract. Extend it to create a channel provider.');
  }
  get name() { return this.constructor.name; }
  async send(_p) { throw new Error(this.name + '.send() is not implemented.'); }
}
module.exports = BaseProvider;