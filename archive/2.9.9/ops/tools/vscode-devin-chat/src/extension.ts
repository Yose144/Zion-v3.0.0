import * as vscode from 'vscode';
import { spawn } from 'node:child_process';

const PARTICIPANT_ID = 'zion-devin.chat';
const CONFIG_SECTION = 'devinChat';
const DEFAULT_MODEL = 'claude-opus-4.7';

type StoredTarget = 'workspace' | 'global';

export function activate(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handleChatRequest);
  participant.followupProvider = {
    provideFollowups: () => {
      return [
        {
          prompt: '/status',
          label: 'Show Devin status'
        },
        {
          prompt: '/model',
          label: 'Show current model'
        }
      ];
    }
  };

  context.subscriptions.push(participant);
  context.subscriptions.push(vscode.commands.registerCommand('zionDevin.setModel', setModelFromCommand));
  context.subscriptions.push(vscode.commands.registerCommand('zionDevin.showStatus', showStatusCommand));
}

export function deactivate(): void {}

async function handleChatRequest(
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  if (request.command === 'model') {
    await handleModelCommand(request, stream);
    return;
  }

  if (request.command === 'status') {
    await handleStatusCommand(stream, token);
    return;
  }

  const configuration = getConfiguration();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const cwd = workspaceFolder?.uri.fsPath ?? vscode.env.appRoot;
  const model = configuration.get<string>('model', DEFAULT_MODEL);
  const systemPrompt = configuration.get<string>('systemPrompt') ?? '';

  stream.progress(`Running Devin with model ${model}`);

  const prompt = buildPrompt(systemPrompt, workspaceFolder, chatContext, request.prompt);
  const result = await runDevinPrompt(prompt, cwd, token);

  if (!result.ok) {
    stream.markdown([
      `Devin request failed.`,
      '',
      '```text',
      result.stderr.trim() || result.stdout.trim() || 'Unknown error',
      '```'
    ].join('\n'));
    return;
  }

  const text = result.stdout.trim();
  stream.markdown(text || '_Devin returned an empty response._');
}

function buildPrompt(
  systemPrompt: string,
  workspaceFolder: vscode.WorkspaceFolder | undefined,
  chatContext: vscode.ChatContext,
  latestPrompt: string
): string {
  const lines: string[] = [];

  if (systemPrompt.trim()) {
    lines.push(systemPrompt.trim(), '');
  }

  if (workspaceFolder) {
    lines.push(`Workspace root: ${workspaceFolder.uri.fsPath}`, '');
  }

  const historyBlocks = chatContext.history.flatMap((turn) => {
    if (isChatRequestTurn(turn)) {
      return [`User: ${turn.prompt}`];
    }

    return [];
  });

  if (historyBlocks.length > 0) {
    lines.push('Conversation so far:');
    lines.push(...historyBlocks, '');
  }

  lines.push(`Latest user request: ${latestPrompt}`);
  return lines.join('\n');
}

function isChatRequestTurn(value: unknown): value is vscode.ChatRequestTurn {
  return value !== null && typeof value === 'object' && 'prompt' in value;
}

async function handleModelCommand(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream
): Promise<void> {
  const raw = request.prompt.trim();
  if (!raw) {
    const current = getConfiguration().get<string>('model', DEFAULT_MODEL);
    stream.markdown(`Current Devin model: **${current}**\n\nUse \`/model claude-opus-4.7\` to change it.`);
    return;
  }

  const nextModel = raw.replace(/^model\s+/i, '').trim();
  if (!nextModel) {
    stream.markdown('Provide a model name after `/model`, for example `/model claude-opus-4.7`.');
    return;
  }

  await updateStoredModel(nextModel);
  stream.markdown(`Saved Devin model as **${nextModel}**.`);
}

async function handleStatusCommand(
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const cwd = workspaceFolder?.uri.fsPath ?? vscode.env.appRoot;
  const model = getConfiguration().get<string>('model', DEFAULT_MODEL);
  const result = await runDevinRaw(['auth', 'status'], cwd, token);

  const lines = [
    `Configured model: **${model}**`,
    '',
    '```text',
    (result.stdout || result.stderr || 'No output').trim(),
    '```'
  ];

  stream.markdown(lines.join('\n'));
}

async function setModelFromCommand(): Promise<void> {
  const configuration = getConfiguration();
  const current = configuration.get<string>('model', DEFAULT_MODEL);
  const picked = await vscode.window.showQuickPick(
    [
      DEFAULT_MODEL,
      'claude-opus-4.6',
      'claude-sonnet-4',
      'codex'
    ].map((label) => ({ label, description: label === current ? 'current' : undefined })),
    {
      placeHolder: 'Select the Devin model to persist for this VS Code workspace'
    }
  );

  if (!picked) {
    return;
  }

  await updateStoredModel(picked.label);
  vscode.window.showInformationMessage(`Devin model saved: ${picked.label}`);
}

async function showStatusCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const cwd = workspaceFolder?.uri.fsPath ?? vscode.env.appRoot;
  const result = await runDevinRaw(['auth', 'status'], cwd);
  const model = getConfiguration().get<string>('model', DEFAULT_MODEL);

  await vscode.window.showInformationMessage(`Devin model: ${model}`);
  const doc = await vscode.workspace.openTextDocument({
    content: [
      `Configured model: ${model}`,
      '',
      result.stdout || result.stderr || 'No output'
    ].join('\n'),
    language: 'text'
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function updateStoredModel(model: string): Promise<void> {
  const configuration = getConfiguration();
  const target = configuration.get<StoredTarget>('configurationTarget', 'workspace');
  const updateTarget = target === 'global'
    ? vscode.ConfigurationTarget.Global
    : vscode.ConfigurationTarget.Workspace;

  await configuration.update('model', model, updateTarget);
}

function getConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

async function runDevinPrompt(
  prompt: string,
  cwd: string,
  token?: vscode.CancellationToken
): Promise<ProcessResult> {
  const configuration = getConfiguration();
  const model = configuration.get<string>('model', DEFAULT_MODEL);
  const permissionMode = configuration.get<string>('permissionMode', 'auto');
  const extraArgs = configuration.get<string[]>('extraArgs', []);

  const args = [
    '--model', model,
    '--permission-mode', permissionMode,
    ...extraArgs,
    '-p', prompt
  ];

  return runDevinRaw(args, cwd, token);
}

type ProcessResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
};

function runDevinRaw(
  args: string[],
  cwd: string,
  token?: vscode.CancellationToken
): Promise<ProcessResult> {
  const configuration = getConfiguration();
  const cliPath = configuration.get<string>('cliPath', 'devin');

  return new Promise((resolve) => {
    const child = spawn(cliPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: ProcessResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      finish({ ok: false, stdout, stderr: `${stderr}\n${error.message}`.trim(), code: null });
    });

    child.on('close', (code) => {
      finish({ ok: code === 0, stdout, stderr, code });
    });

    token?.onCancellationRequested(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
    });
  });
}