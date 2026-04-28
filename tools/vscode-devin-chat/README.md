# ZION Devin Chat

Minimal VS Code extension that adds `@devin` into the built-in Chat view and routes requests through the local Devin CLI.

## What it does

- Adds `@devin` to the built-in chat UI.
- Persists the default model through VS Code settings.
- Defaults to `claude-opus-4.7`.
- Supports `/model` and `/status` slash commands inside chat.

## Settings

- `devinChat.cliPath` — path to the Devin CLI, default `devin`
- `devinChat.model` — persisted model, default `claude-opus-4.7`
- `devinChat.permissionMode` — `auto` or `dangerous`
- `devinChat.extraArgs` — extra CLI args
- `devinChat.systemPrompt` — prompt prefix
- `devinChat.configurationTarget` — `workspace` or `global`

## Run

```bash
cd tools/vscode-devin-chat
npm install
npm run compile
```

Then open this folder in VS Code and run the extension in an Extension Development Host.

## Use in chat

```text
@devin explain this Rust workspace
@devin /status
@devin /model claude-opus-4.7
```