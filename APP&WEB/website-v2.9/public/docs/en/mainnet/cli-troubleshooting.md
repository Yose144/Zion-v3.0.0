# ZION CLI Troubleshooting

## 1. `zion status` is unhealthy

Run:

```bash
zion status
zion node status
zion agent status
```

If both node and agent fail, suspect host or deploy-level issues first.

## 2. `zion agent` is in fallback mode

That usually means the service is alive but the model backend is unavailable.

Check:

```bash
zion agent status
zion agent config
zion logs ai-native
```

## 3. Lifecycle commands seem to hit the wrong target

The CLI maps to compose service names, not guessed container labels.

Important examples:

- `node` or `core` -> `core`
- `agent` or `ai-native` -> `ai-native`
- `monitoring` -> monitoring bundle

Unsupported lifecycle targets should now fail locally with a clear supported-target list before any SSH call is attempted.

## 4. Public docs are missing after a docs change

The website reads markdown from the website public docs tree.

Repo docs alone are not enough.

Validate with:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## 5. Config changes do not seem active

Check the active file first:

```bash
zion config path
zion config show
```

Then re-apply the intended setting or re-run:

```bash
zion config init
```

## 6. Fast triage order

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <affected-service>`