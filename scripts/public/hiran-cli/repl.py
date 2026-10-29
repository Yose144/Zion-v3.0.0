"""Session REPL: slash commands, streamed chat, optional local tools."""
import json
import os
import sys
import time
import urllib.parse
import webbrowser

from api import ApiError, redact, request_json, stream_chat
from config import MAX_TURNS, load, signed_in, update_file
from session import Session, for_request
from splash import splash, status_line
from tools import (
    TOOL_DEFS,
    Policy,
    calls_from_acc,
    execute,
    openai_message,
)

MENU = """\
  What do you want to do?

    1  Chat
    2  Login
    3  Account
    4  Models
    5  Coding agent
    6  Subscribe
    7  Session
    8  Help
    9  FAQ
   10  Glossary
    q  Quit

  Or type a message to chat once.  ? for the guide.
"""

HELP = """\
  Zion Hiran

  Hiranyagarbha in the terminal. Chat and an optional coding agent talk to
  the EU gateway. The API key stays in ~/.zion/agent.toml (mode 600) and is
  never printed. The transcript is ~/.zion/hiran/session.json.

  First run
    curl -fsSL https://market.zionterranova.com/install-hiran.sh | bash
    zion-hiran
    Choose 2 Login, approve the code in the browser, then 1 Chat.

  Menu                         Same command
    1  Chat                    /chat    or just type
    2  Login                   /login
    3  Account                 /usage
    4  Models                  /models  /model <id>
    5  Coding agent            /agent
    6  Subscribe               opens the plans page
    7  Session                 /clear   /resume
    8  Help                    /help    ?
    9  FAQ                     /faq
   10  Glossary                /glossary
    q  Quit                    /quit

  From Chat, /menu returns here. An empty Enter reprints this menu.
  One-shot, no menu:  zion-hiran login | models | usage | chat TEXT | faq | glossary

  Coding agent
    Turn it on with 5 or /agent, then describe the task in Chat.
    It may read_file, str_replace, and run_shell inside this directory.
    A write or a shell command asks you first.
    Allowed shell commands are a short list (ls, git, python3, cargo, …).
    No pipes, redirects, or chained commands.
    Blocked: paths outside this directory, .env, keys, mnemonics, .zion.

  On the web
    Plans and models     https://market.zionterranova.com/ai
    Approve this login   https://market.zionterranova.com/ai/cli
    Download             https://app.zionterranova.com/download#hiran-cli

  More
    9 or /faq         common questions
   10 or /glossary    what the words mean
"""

FAQ = """\
  FAQ

  What is Zion Hiran?
    The public terminal client for Hiranyagarbha. It chats with the EU
    gateway. The operator binary `zion` is a different, larger tool.

  Where is the API key, and why is it never printed?
    ~/.zion/agent.toml, mode 600. The CLI says "signed in" and does not
    echo the key.

  Why does login open a browser?
    You approve a short device code at
    https://market.zionterranova.com/ai/cli
    The key is saved when you return here.

  Chat or Coding agent?
    Chat only talks. Coding agent (menu 5, /agent) may read and edit
    files in this directory, and it asks before a write or a shell command.

  Why can't I select a model?
    Offline and mockup models are listed, but only a live model can be
    the active one. hiran-mini is the usual choice.

  What is the daily limit?
    Each plan has a token cap. Menu 3 Account (/usage) shows used today
    and what is left. A 429 means the cap was hit.

  Will the agent write without asking?
    No. read_file runs. str_replace and run_shell wait for y/N.
    Paths outside this directory, .env, keys, and pipes are refused.

  Where is the conversation, and how do I delete it?
    ~/.zion/hiran/session.json. Menu 7 Session, then c, or /clear.
"""

GLOSSARY = """\
  Glossary

  Chat            one conversation with Hiran, no file tools
  Login           browser approval that stores your API key
  Account         plan, tokens used today, what is left
  Model           which Hiran alias answers (default hiran-mini)
  live            the model can answer right now
  offline         listed, but not accepting chats
  mockup          a preview name, not a real model yet
  Coding agent    chat plus read, replace, and an allowlisted shell
  Subscribe       opens Free / Pro / Team on the Market /ai page
  Session         saved transcript for this CLI
  API key         secret in ~/.zion/agent.toml, never printed
  flowers         1 ZION = 1 000 000 flowers
  plan            Free, Pro, or Team — the limit on Account
"""

ASK = (
    "You are Hiranyagarbha (Hiran), the ZION assistant. "
    "Answer in the user's language, in plain text. "
    "Fee split is 89/5/5/1. 1 ZION = 1000000 flowers. "
    "Do not invent live network numbers."
)


def agent_system(cwd):
    return (
        "You are the ZION Hiran coding agent. Work only inside this directory: %s\n"
        "Tools: read_file, str_replace, run_shell. Prefer native function calls. "
        'If you cannot, emit one fence: ```json {"tool":"NAME","args":{...}} ```\n'
        "No pipes, redirects, or secret files (.env, keys, mnemonics, .zion). "
        "After tool results, answer the user in plain text."
    ) % cwd


def _read(prompt):
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None


def slash(line, session):
    """Run a slash command. Return 'quit', 'menu', 'ok', or None if it is chat text."""
    cmd, _, arg = line.partition(" ")
    cmd = cmd.strip().lower()
    arg = arg.strip()
    if cmd in ("/quit", "/exit", "quit", "exit"):
        return "quit"
    if cmd in ("/menu",):
        return "menu"
    if cmd in ("/help", "help", "?"):
        sys.stdout.write(HELP)
        return "ok"
    if cmd == "/faq":
        sys.stdout.write(FAQ)
        return "ok"
    if cmd == "/glossary":
        sys.stdout.write(GLOSSARY)
        return "ok"
    if cmd == "/clear":
        session.clear()
        print("  session cleared")
        return "ok"
    if cmd == "/resume":
        _resume(session)
        return "ok"
    if cmd == "/agent":
        session.agent = not session.agent
        session.save()
        print("  coding tools %s" % ("on" if session.agent else "off"))
        return "ok"
    if cmd == "/login":
        _login()
        return "ok"
    if cmd == "/logout":
        _logout()
        return "ok"
    if cmd == "/models":
        _models()
        return "ok"
    if cmd == "/model":
        _set_model(arg)
        return "ok"
    if cmd in ("/usage", "/account"):
        _usage(session, talk=True)
        return "ok"
    if cmd == "/chat":
        if arg:
            _chat(arg, session)
        return "chat"
    if cmd.startswith("/"):
        print("  unknown command — /help")
        return "ok"
    return None


def home(session):
    while True:
        print(status_line(session))
        sys.stdout.write(MENU)
        line = _read("  › ")
        if line is None:
            return
        if not line:
            continue
        try:
            action = home_choice(line, session)
        except Exception as err:
            print("  " + redact(err))
            print()
            continue
        print()
        if action == "quit":
            return
        if action == "chat":
            if chat_loop(session) == "quit":
                return
            print()


def home_choice(line, session):
    if line.lower() in ("q", "0"):
        return "quit"
    picked = slash(line, session)
    if picked == "chat":
        return "chat"
    if picked is not None:
        return picked
    if line == "1":
        return "chat"
    if line == "2":
        _login()
        return "ok"
    if line == "3":
        _usage(session, talk=True)
        return "ok"
    if line == "4":
        _models()
        _set_model("")
        return "ok"
    if line == "5":
        _enable_agent(session)
        return "ok"
    if line == "6":
        _subscribe()
        return "ok"
    if line == "7":
        _session_menu(session)
        return "ok"
    if line == "8":
        sys.stdout.write(HELP)
        return "ok"
    if line == "9":
        sys.stdout.write(FAQ)
        return "ok"
    if line == "10":
        sys.stdout.write(GLOSSARY)
        return "ok"
    _chat(line, session)
    return "ok"


def chat_loop(session):
    print(status_line(session))
    print("  Chat — /menu home, /help guide, /quit leave")
    while True:
        line = _read("  chat › ")
        if line is None:
            return "quit"
        if not line:
            continue
        try:
            picked = slash(line, session)
            if picked == "quit":
                return "quit"
            if picked == "menu":
                return "ok"
            if picked == "chat":
                continue
            if picked is None:
                _chat(line, session)
        except Exception as err:
            print("  " + redact(err))
        print()


def loop():
    session = Session(os.getcwd())
    session.load_from_disk()
    splash()
    home(session)


def _resume(session):
    if session.load_from_disk():
        print("  session restored (%d messages)" % len(session.messages))
    else:
        print("  no saved session")


def _enable_agent(session):
    session.agent = True
    session.save()
    print("  coding tools on")
    print("  cwd: %s" % session.cwd)
    print("  Tools: read_file, str_replace, run_shell.")
    print("  A write or a shell command asks you first.")
    print("  Blocked: paths outside this directory, .env, keys, pipes.")
    print("  Open Chat (1) and describe the task.")


def _subscribe():
    url = load()["market"] + "/ai"
    print("  Plans Free / Pro / Team:")
    print("   ", url)
    try:
        webbrowser.open(url)
    except Exception:
        pass


def _session_menu(session):
    print("  messages: %d" % len(session.messages))
    print("  cwd:      %s" % session.cwd)
    print("  agent:    %s" % ("on" if session.agent else "off"))
    print("    c  clear")
    print("    r  resume")
    print("    enter  back")
    choice = _read("  session › ")
    if choice is None:
        return
    if choice.lower() in ("c", "clear", "/clear"):
        session.clear()
        print("  session cleared")
    elif choice.lower() in ("r", "resume", "/resume"):
        _resume(session)


def _need_key():
    cfg = load()
    if not signed_in(cfg):
        print("  sign in first — /login")
        return None
    return cfg


def _chat(text, session):
    cfg = _need_key()
    if not cfg:
        return
    session.add({"role": "user", "content": text})
    policy = Policy(session.cwd)
    try:
        if not session.agent:
            acc = _complete(session, cfg, with_tools=False)
            _store_assistant(session, acc, native=False)
            if not (acc.get("content") or "").strip():
                print("  (empty)")
            return
        for _turn in range(MAX_TURNS):
            acc = _complete(session, cfg, with_tools=True)
            calls, native = calls_from_acc(acc)
            if not calls:
                _store_assistant(session, acc, native=False)
                if not (acc.get("content") or "").strip():
                    print("  (empty)")
                return
            _store_assistant(session, acc, native=native, calls=calls)
            for call in calls:
                print("  · %s" % call["name"])
                result = execute(policy, call)
                preview = result.replace("\n", " ")
                if len(preview) > 160:
                    preview = preview[:160] + "…"
                print("  → %s" % preview)
                if native:
                    session.add(openai_message(call, result))
                else:
                    session.add({
                        "role": "user",
                        "content": "TOOL_RESULT name=%s:\n%s" % (call["name"], result),
                    })
        print("  stopped: turn limit (%d)" % MAX_TURNS)
    except ApiError as err:
        print()
        if err.status == 429:
            _limit_note(cfg, session)
        else:
            print("  error: " + redact(err))


def _complete(session, cfg, with_tools):
    system = agent_system(session.cwd) if with_tools else ASK
    body = {
        "model": cfg["model"],
        "messages": for_request(session, system, with_tools),
        "temperature": 0.2,
        "max_tokens": 2048 if with_tools else 1024,
    }
    if with_tools:
        body["tools"] = TOOL_DEFS
        body["tool_choice"] = "auto"
    started = {"on": False}

    def on_text(piece):
        if not started["on"]:
            sys.stdout.write("\n  Hiran  ")
            started["on"] = True
        sys.stdout.write(piece)
        sys.stdout.flush()

    acc = stream_chat(
        cfg["base_url"] + "/chat/completions",
        cfg["api_key"],
        body,
        on_text,
    )
    if started["on"]:
        sys.stdout.write("\n")
        sys.stdout.flush()
    return acc


def _store_assistant(session, acc, native, calls=None):
    content = acc.get("content") or ""
    if native and calls:
        session.add({
            "role": "assistant",
            "content": content or None,
            "tool_calls": [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {
                        "name": call["name"],
                        "arguments": json.dumps(call["args"]),
                    },
                }
                for call in calls
            ],
        })
        return
    session.add({"role": "assistant", "content": content})


def _login():
    cfg = load()
    try:
        _status, body = request_json("POST", cfg["market"] + "/api/hiran/cli/start", {})
    except ApiError as err:
        print("  login failed: " + redact(err))
        return
    data = (body or {}).get("data") or {}
    device = data.get("device_code")
    if not device:
        print("  login failed")
        return
    url = data.get("verify_url") or (cfg["market"] + "/ai/cli")
    print("  Open and approve:\n   ", url)
    if data.get("user_code"):
        print("  code:", data.get("user_code"))
    try:
        webbrowser.open(url)
    except Exception:
        pass
    deadline = time.time() + int(data.get("expires_in") or 600)
    interval = int(data.get("interval") or 2)
    while time.time() < deadline:
        time.sleep(max(1, interval))
        try:
            _status, pol = request_json(
                "GET",
                cfg["market"] + "/api/hiran/cli/poll?device_code=" + urllib.parse.quote(device),
            )
        except ApiError as err:
            print("\n  login failed: " + redact(err))
            return
        st = ((pol or {}).get("data") or {}).get("status")
        if st == "approved":
            api = (pol.get("data") or {}).get("apiKey") or ""
            if api.startswith("zis_"):
                update_file(api_key=api, base_url=cfg["base_url"], model=cfg["model"])
                print("\n  signed in")
            else:
                print("\n  login failed")
            return
        if st in ("expired", "redeemed"):
            print("\n  login " + st)
            return
        sys.stdout.write("  waiting…\r")
        sys.stdout.flush()
    print("\n  login timed out")


def _logout():
    update_file(api_key=None)
    if os.environ.get("ZION_HIRAN_API_KEY", "").strip():
        print("  key removed from the file; this shell still has ZION_HIRAN_API_KEY")
        return
    print("  signed out")


def _models():
    rows = _model_rows()
    if rows is None:
        return
    if not rows:
        print("  no models")
        return
    width = max(len(mid) for mid, _flag in rows)
    for mid, flag in rows:
        print("  %s  %s" % (mid.ljust(width), flag))


def _set_model(name):
    rows = _model_rows()
    if rows is None:
        return
    live = [mid for mid, flag in rows if flag == "live"]
    if not name:
        if not live:
            print("  no live model")
            return
        print("  live: " + ", ".join(live))
        try:
            name = input("  model › ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
    if name not in live:
        print("  %s is not a live model" % name)
        return
    update_file(model=name)
    print("  model set to " + name)


def _model_rows():
    cfg = load()
    try:
        _status, body = request_json("GET", cfg["base_url"] + "/models", key=cfg["api_key"] or None)
    except ApiError as err:
        print("  " + redact(err))
        return None
    rows = []
    for item in (body or {}).get("data") or []:
        if not isinstance(item, dict):
            continue
        mid = item.get("id") or ""
        if item.get("x-mockup"):
            flag = "mockup"
        elif item.get("x-available"):
            flag = "live"
        else:
            flag = "offline"
        rows.append((mid, flag))
    return rows


def _usage(session, talk):
    cfg = _need_key()
    if not cfg:
        return None
    try:
        _status, body = request_json("GET", cfg["base_url"] + "/usage", key=cfg["api_key"])
    except ApiError as err:
        if talk:
            print("  " + redact(err))
        return None
    plan = body.get("plan")
    if isinstance(plan, str) and plan:
        session.plan = plan
        session.save()
    if talk:
        limits = body.get("limits") or {}
        used = body.get("used_today")
        daily = limits.get("tokens_per_day")
        print("  plan:       ", plan)
        print("  used today: ", used)
        print("  rpm / day:  ", limits.get("requests_per_minute"), "/", daily)
        if isinstance(used, int) and isinstance(daily, int):
            print("  left today: ", max(0, daily - used))
    return body


def _limit_note(cfg, session):
    print("  rate limit")
    body = _usage(session, talk=False)
    if not body:
        return
    limits = body.get("limits") or {}
    used = body.get("used_today")
    daily = limits.get("tokens_per_day")
    print("  used today %s / %s" % (used, daily))


def main(argv):
    from config import VERSION

    if len(argv) <= 1:
        loop()
        return 0
    cmd = argv[1]
    if cmd in ("-h", "--help", "help"):
        print("zion-hiran " + VERSION)
        sys.stdout.write(HELP)
        return 0
    if cmd == "faq":
        sys.stdout.write(FAQ)
        return 0
    if cmd == "glossary":
        sys.stdout.write(GLOSSARY)
        return 0
    if cmd in ("-V", "--version"):
        print(VERSION)
        return 0
    session = Session(os.getcwd())
    session.load_from_disk()
    if cmd == "login":
        _login()
        return 0
    if cmd == "models":
        _models()
        return 0
    if cmd == "usage":
        _usage(session, talk=True)
        return 0
    if cmd == "chat":
        text = " ".join(argv[2:]).strip()
        if not text:
            print("usage: zion-hiran chat TEXT")
            return 1
        _chat(text, session)
        return 0
    print("usage: zion-hiran [login|models|usage|chat TEXT|faq|glossary|help]")
    return 1
