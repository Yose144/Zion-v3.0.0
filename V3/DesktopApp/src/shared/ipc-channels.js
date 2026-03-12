const IPC_CHANNELS = {
  APP_INFO: 'app:info',
  WALLETS_LIST: 'wallets:list',
  WALLETS_CREATE: 'wallets:create',
  WALLETS_IMPORT: 'wallets:import',
  WALLETS_REMOVE: 'wallets:remove',
  RUNTIME_STATE: 'runtime:state',
  RUNTIME_CONFIGURE: 'runtime:configure',
  RUNTIME_START: 'runtime:start',
  RUNTIME_STOP: 'runtime:stop',
  RUNTIME_RESTART: 'runtime:restart',
  RUNTIME_START_STACK: 'runtime:start-stack',
  RUNTIME_STOP_STACK: 'runtime:stop-stack',
  RUNTIME_STATE_CHANGED: 'runtime:state-changed',
  UPDATES_STATUS: 'updates:status',
  UPDATES_CHECK: 'updates:check',
  UPDATES_INSTALL: 'updates:install'
};

module.exports = { IPC_CHANNELS };
