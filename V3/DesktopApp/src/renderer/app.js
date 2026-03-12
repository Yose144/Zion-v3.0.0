const state = {
  wallets: [],
  runtime: null,
  updateStatus: null,
  appInfo: null
};

function byId(id) {
  return document.getElementById(id);
}

function setActivePanel(panelName) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.panel === panelName);
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${panelName}`);
  });
}

function renderAppInfo() {
  if (!state.appInfo) {
    return;
  }
  byId('app-version').textContent = state.appInfo.version;
  byId('runtime-line').textContent = state.appInfo.runtimeLine;
  byId('wallet-count').textContent = String(state.wallets.length);
}

function escapeText(value) {
  return String(value == null ? '' : value);
}

function badgeClass(stateName) {
  switch (stateName) {
    case 'online':
    case 'running':
      return 'badge badge-online';
    case 'partial':
    case 'starting':
    case 'stopping':
      return 'badge badge-partial';
    case 'degraded':
    case 'error':
      return 'badge badge-degraded';
    default:
      return 'badge badge-offline';
  }
}

function metricPill(label, value) {
  const pill = document.createElement('div');
  pill.className = 'metric-pill';

  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  const valueNode = document.createElement('strong');
  valueNode.textContent = value;

  pill.append(labelNode, valueNode);
  return pill;
}

function renderUpdateStatus() {
  if (!state.updateStatus) {
    return;
  }
  byId('update-state').textContent = state.updateStatus.state;
  byId('update-message').textContent = state.updateStatus.message || '';
}

function renderRuntime() {
  if (!state.runtime) {
    return;
  }

  const { stack, services } = state.runtime;
  byId('stack-state').textContent = stack.state;
  byId('stack-summary').textContent = `${stack.runningCount}/${stack.total} services active`;
  byId('overview-stack-state').textContent = stack.state;

  const surfaceCount = byId('surface-runtime-count');
  surfaceCount.className = badgeClass(stack.state);
  surfaceCount.textContent = `${stack.runningCount} / ${stack.total} running`;

  const overviewStrip = byId('overview-service-strip');
  overviewStrip.replaceChildren();

  const runtimeContainer = byId('runtime-services');
  runtimeContainer.replaceChildren();

  const overviewFragment = document.createDocumentFragment();
  const runtimeFragment = document.createDocumentFragment();

  services.forEach((service) => {
    const overview = document.createElement('article');
    overview.className = 'service-overview-item';

    const header = document.createElement('div');
    header.className = 'split-row';
    const title = document.createElement('strong');
    title.textContent = service.label;
    const badge = document.createElement('span');
    badge.className = badgeClass(service.status);
    badge.textContent = service.status;
    header.append(title, badge);

    const text = document.createElement('p');
    text.textContent = service.description;
    overview.append(header, text);
    overviewFragment.appendChild(overview);

    const card = document.createElement('article');
    card.className = 'service-card';

    const toolbar = document.createElement('div');
    toolbar.className = 'service-toolbar split-row';
    const titleWrap = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = service.label;
    const desc = document.createElement('p');
    desc.className = 'service-description';
    desc.textContent = service.description;
    titleWrap.append(h3, desc);

    const status = document.createElement('span');
    status.className = badgeClass(service.status);
    status.textContent = service.status;
    toolbar.append(titleWrap, status);

    const meta = document.createElement('div');
    meta.className = 'service-meta';
    meta.append(
      metricPill('Binary', service.exists ? 'Ready' : 'Missing'),
      metricPill('PID', service.pid ? String(service.pid) : 'n/a'),
      metricPill('Exit', service.exitCode == null ? 'n/a' : String(service.exitCode))
    );

    const pathNode = document.createElement('div');
    pathNode.className = 'service-path';
    pathNode.textContent = service.binaryPath;

    const envGrid = document.createElement('div');
    envGrid.className = 'service-env';
    Object.entries(service.env).forEach(([key, value]) => {
      const label = document.createElement('label');
      label.dataset.serviceId = service.id;
      label.dataset.envKey = key;
      label.textContent = key;
      const input = document.createElement('input');
      input.value = escapeText(value);
      input.dataset.serviceId = service.id;
      input.dataset.envKey = key;
      label.appendChild(input);
      envGrid.appendChild(label);
    });

    const actions = document.createElement('div');
    actions.className = 'service-actions';
    actions.append(
      actionButton('Save Config', 'configure', service.id, 'ghost-button'),
      actionButton('Start', 'start', service.id, 'ghost-button'),
      actionButton('Restart', 'restart', service.id, 'ghost-button'),
      actionButton('Stop', 'stop', service.id, 'ghost-button')
    );

    const metrics = document.createElement('div');
    metrics.className = 'service-metrics';
    const metricEntries = Object.entries(service.metrics).slice(-6);
    if (!metricEntries.length) {
      const empty = document.createElement('span');
      empty.className = 'service-empty';
      empty.textContent = service.lastError || 'No live metrics yet.';
      metrics.appendChild(empty);
    } else {
      metricEntries.forEach(([key, value]) => metrics.appendChild(metricPill(key, value)));
    }

    const log = document.createElement('div');
    log.className = 'service-log';
    if (!service.logs.length) {
      const empty = document.createElement('div');
      empty.className = 'service-empty';
      empty.textContent = 'Logs will appear here after the service starts.';
      log.appendChild(empty);
    } else {
      const logFragment = document.createDocumentFragment();
      service.logs.slice(-24).forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'log-entry';

        const time = document.createElement('time');
        time.textContent = new Date(entry.ts).toLocaleTimeString();
        const stream = document.createElement('span');
        stream.className = 'log-stream';
        stream.textContent = entry.stream;
        const message = document.createElement('span');
        message.textContent = entry.message;

        row.append(time, stream, message);
        logFragment.appendChild(row);
      });
      log.appendChild(logFragment);
    }

    card.append(toolbar, meta, pathNode, envGrid, actions, metrics, log);
    runtimeFragment.appendChild(card);
  });

  overviewStrip.appendChild(overviewFragment);
  runtimeContainer.appendChild(runtimeFragment);
}

function renderWallets() {
  const container = byId('wallet-list');
  const note = byId('wallet-protection-note');
  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  if (!state.wallets.length) {
    const empty = document.createElement('article');
    empty.className = 'wallet-item';
    const meta = document.createElement('div');
    meta.className = 'wallet-meta';
    const title = document.createElement('strong');
    title.textContent = 'No wallets yet';
    const hint = document.createElement('span');
    hint.textContent = 'Create or import the first operator wallet.';
    meta.append(title, hint);
    empty.appendChild(meta);
    fragment.appendChild(empty);
  }

  const protectedCount = state.wallets.filter((wallet) => wallet.protected).length;
  note.textContent = `${protectedCount}/${state.wallets.length} wallets protected by platform encryption`;

  state.wallets.forEach((wallet) => {
    const item = document.createElement('article');
    item.className = 'wallet-item';
    const meta = document.createElement('div');
    meta.className = 'wallet-meta';

    const title = document.createElement('strong');
    title.textContent = wallet.name;
    const role = document.createElement('div');
    role.className = 'wallet-subline';
    role.textContent = `role: ${wallet.role}`;
    const address = document.createElement('div');
    address.textContent = wallet.address;
    const detail = document.createElement('div');
    detail.className = 'wallet-subline';
    detail.textContent = `${wallet.source} · ${wallet.protected ? 'encrypted' : 'plaintext fallback'} · ${new Date(wallet.createdAt).toLocaleString()}`;

    meta.append(title, role, address, detail);

    const actions = document.createElement('div');
    actions.className = 'wallet-actions';
    actions.appendChild(actionButton('Remove', 'wallet-remove', wallet.id, 'ghost-button'));

    item.append(meta, actions);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);

  renderAppInfo();
}

function actionButton(label, action, value, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.action = action;
  button.dataset.value = value;
  button.textContent = label;
  return button;
}

function revealSecret(title, payload) {
  const card = byId('wallet-reveal-card');
  const output = byId('wallet-reveal-output');
  card.hidden = false;
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

async function refreshWallets() {
  state.wallets = await window.zionDesktop.listWallets();
  renderWallets();
}

async function refreshRuntime() {
  state.runtime = await window.zionDesktop.getRuntimeState();
  renderRuntime();
}

function collectEnv(serviceId) {
  const entries = document.querySelectorAll(`input[data-service-id="${serviceId}"]`);
  return Array.from(entries).reduce((accumulator, input) => {
    accumulator[input.dataset.envKey] = input.value;
    return accumulator;
  }, {});
}

async function configureRuntime(serviceId) {
  state.runtime = await window.zionDesktop.configureRuntime(serviceId, collectEnv(serviceId));
  renderRuntime();
}

async function boot() {
  state.appInfo = await window.zionDesktop.appInfo();
  state.runtime = await window.zionDesktop.getRuntimeState();
  state.updateStatus = await window.zionDesktop.getUpdateStatus();
  await refreshWallets();
  renderAppInfo();
  renderRuntime();
  renderUpdateStatus();
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => setActivePanel(item.dataset.panel));
});

byId('refresh-wallets').addEventListener('click', refreshWallets);
byId('refresh-runtime').addEventListener('click', refreshRuntime);
byId('start-stack').addEventListener('click', async () => {
  state.runtime = await window.zionDesktop.startRuntimeStack();
  renderRuntime();
});
byId('stop-stack').addEventListener('click', async () => {
  state.runtime = await window.zionDesktop.stopRuntimeStack();
  renderRuntime();
});

byId('hide-wallet-reveal').addEventListener('click', () => {
  byId('wallet-reveal-card').hidden = true;
  byId('wallet-reveal-output').textContent = '';
});

byId('create-wallet-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await window.zionDesktop.createWallet({
      name: byId('create-wallet-name').value,
      role: byId('create-wallet-role').value
    });
    byId('create-wallet-form').reset();
    revealSecret('Created wallet secret', response.reveal);
    await refreshWallets();
  } catch (error) {
    revealSecret('Create wallet error', { message: error.message || String(error) });
  }
});

byId('import-wallet-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await window.zionDesktop.importWallet({
      name: byId('import-wallet-name').value,
      role: byId('import-wallet-role').value,
      secret: byId('import-wallet-secret').value
    });
    byId('import-wallet-form').reset();
    revealSecret('Imported wallet secret', response.reveal);
    await refreshWallets();
  } catch (error) {
    revealSecret('Import wallet error', { message: error.message || String(error) });
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const { action, value } = button.dataset;
  if (action === 'wallet-remove') {
    await window.zionDesktop.removeWallet(value);
    await refreshWallets();
    return;
  }

  if (!['configure', 'start', 'stop', 'restart'].includes(action)) {
    return;
  }

  if (action === 'configure') {
    await configureRuntime(value);
    return;
  }

  await configureRuntime(value);

  if (action === 'start') {
    state.runtime = await window.zionDesktop.startRuntime(value);
  }

  if (action === 'stop') {
    state.runtime = await window.zionDesktop.stopRuntime(value);
  }

  if (action === 'restart') {
    state.runtime = await window.zionDesktop.restartRuntime(value);
  }

  renderRuntime();
});

window.zionDesktop.onRuntimeState((payload) => {
  state.runtime = payload;
  renderRuntime();
});

window.zionDesktop.onUpdateStatus((payload) => {
  state.updateStatus = payload;
  renderUpdateStatus();
});

boot();
