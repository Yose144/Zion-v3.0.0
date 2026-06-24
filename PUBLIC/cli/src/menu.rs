//! Interactive arrow-key menu — autonomous guided workflow for public users.
//!
//! Design philosophy: walk the user through a natural progression:
//!   1. Create / import / backup wallet
//!   2. Check node connectivity
//!   3. Start mining
//!   4. Check balance / send
//!   5. Chat with AI
//!
//! All actions return `Vec<String>` args that are fed back into `Cli::try_parse_from`.

use anyhow::Result;
use colored::Colorize;
use dialoguer::{theme::ColorfulTheme, Input, Select};

use crate::ui;

const BACK: &str = "← Back";
const EXIT: &str = "Exit";

/// Run the interactive menu. Returns `Some(args)` to dispatch, or `None` to exit.
pub fn run(show_genesis: bool) -> Result<Option<Vec<String>>> {
    print_intro(show_genesis);

    loop {
        let items = [
            "🚀 Guided Setup (recommended for new users)",
            "Wallet — create, import, backup, balance, send",
            "Node — info, chain, peers, supply",
            "Mine — start, stop, status",
            "AI — chat with Hiran",
            "Status — network health check",
            "Doctor — preflight diagnostics",
            "Config — view / set values",
            "Version",
            EXIT,
        ];

        let Some(choice) = select("ZION Public CLI", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => Some(guided_setup_workflow()?),
            1 => wallet_menu()?,
            2 => node_menu()?,
            3 => mine_menu()?,
            4 => ai_menu()?,
            5 => Some(args(&["status"])),
            6 => Some(args(&["doctor"])),
            7 => config_menu()?,
            8 => Some(args(&["version"])),
            9 => return Ok(None),
            _ => None,
        };

        if let Some(argv) = selected {
            return Ok(Some(argv));
        }
    }
}

fn print_intro(show_genesis: bool) {
    if show_genesis {
        ui::print_genesis_banner();
    } else {
        ui::print_compact_banner();
    }
    ui::print_info("Arrow keys navigate · Enter runs · Esc goes back");
    println!();
}

// ─── Guided Setup ─────────────────────────────────────────────────────────────

/// The flagship workflow — walks a new user from zero to mining in 4 steps.
fn guided_setup_workflow() -> Result<Vec<String>> {
    ui::print_header("🚀 Guided Setup — Zero to Mining");

    let steps = [
        "Step 1: Create or import your wallet",
        "Step 2: Back up your mnemonic (CRITICAL)",
        "Step 3: Verify node connectivity",
        "Step 4: Start mining",
        "Skip — back to main menu",
    ];

    loop {
        let Some(choice) = select("Guided Setup", &steps)? else {
            return Ok(args(&["menu"]));
        };

        let argv = match choice {
            0 => guided_step_wallet()?,
            1 => guided_step_backup()?,
            2 => guided_step_node()?,
            3 => guided_step_mine()?,
            _ => return Ok(args(&["menu"])),
        };

        // If the step produced args, return them for dispatch.
        // After dispatch, the user returns to this menu.
        if !argv.is_empty() {
            return Ok(argv);
        }
        // Empty argv = step was informational, loop back to step selection.
    }
}

fn guided_step_wallet() -> Result<Vec<String>> {
    ui::print_header("Step 1: Create or Import Your Wallet");
    println!("  You need a wallet to receive mining rewards and send ZION.");
    println!();

    let items = [
        "Create new wallet with mnemonic (recommended)",
        "Create new wallet (raw keypair, no mnemonic)",
        "Import existing mnemonic",
        "Import existing secret key (hex)",
        "I already have a wallet configured",
        BACK,
    ];

    let Some(choice) = select("Wallet Setup", &items)? else {
        return Ok(vec![]);
    };

    Ok(match choice {
        0 => {
            let out = optional_input(
                "Output file path (blank = zion-wallet.json)",
                Some("zion-wallet.json"),
            )?;
            args_owned(vec![
                "wallet".into(),
                "new".into(),
                "--mnemonic".into(),
                "--out".into(),
                out,
                "--set-default".into(),
                "--print".into(),
            ])
        }
        1 => {
            let out = optional_input(
                "Output file path (blank = zion-wallet.json)",
                Some("zion-wallet.json"),
            )?;
            args_owned(vec![
                "wallet".into(),
                "new".into(),
                "--out".into(),
                out,
                "--set-default".into(),
                "--print".into(),
            ])
        }
        2 => {
            let mnemonic = required_input("Enter your mnemonic words", None)?;
            let out = optional_input(
                "Output file path (blank = zion-wallet.json)",
                Some("zion-wallet.json"),
            )?;
            args_owned(vec![
                "wallet".into(),
                "import-mnemonic".into(),
                "--mnemonic".into(),
                mnemonic,
                "--out".into(),
                out,
                "--set-default".into(),
                "--print".into(),
            ])
        }
        3 => {
            let sk = required_input("Enter 32-byte secret key (64 hex chars)", None)?;
            let out = optional_input(
                "Output file path (blank = zion-wallet.json)",
                Some("zion-wallet.json"),
            )?;
            args_owned(vec![
                "wallet".into(),
                "import-secret-key".into(),
                "--secret-key-hex".into(),
                sk,
                "--out".into(),
                out,
                "--set-default".into(),
                "--print".into(),
            ])
        }
        4 => {
            ui::print_ok("Wallet already configured — proceeding to next step.");
            vec![]
        }
        _ => vec![],
    })
}

fn guided_step_backup() -> Result<Vec<String>> {
    ui::print_header("Step 2: Back Up Your Mnemonic");
    println!();
    println!("  {} If you used a mnemonic wallet, your 24 words are printed", "⚠".yellow().bold());
    println!("  above. Write them down on PAPER and store in a safe place.");
    println!();
    println!("  {} Anyone with these words can steal your funds.", "⚠".red().bold());
    println!("  {} Never share them. Never type them into a website.", "⚠".red().bold());
    println!("  {} Never store them digitally (photo, cloud, email).", "⚠".red().bold());
    println!();
    println!("  To view your wallet info later:");
    println!("    zion wallet info --wallet zion-wallet.json");
    println!();
    println!("  To reveal your mnemonic (requires password if encrypted):");
    println!("    zion wallet reveal --wallet zion-wallet.json");
    println!();

    wait_enter("Press Enter when you've written down your mnemonic...")?;
    ui::print_ok("Backup confirmed. Proceeding to node check.");
    Ok(vec![])
}

fn guided_step_node() -> Result<Vec<String>> {
    ui::print_header("Step 3: Verify Node Connectivity");
    println!("  Checking if the ZION node is reachable...");
    println!();

    // Return the node chain command — it will show height + tip
    Ok(args(&["node", "chain"]))
}

fn guided_step_mine() -> Result<Vec<String>> {
    ui::print_header("Step 4: Start Mining");
    println!("  Almost there! Let's configure and start your miner.");
    println!();

    let items = [
        "Start mining with default settings (CPU, pool mode)",
        "Start mining with GPU (guided)",
        "Start mining with custom settings (guided)",
        "Just show miner status",
        BACK,
    ];

    let Some(choice) = select("Start Mining", &items)? else {
        return Ok(vec![]);
    };

    Ok(match choice {
        0 => args(&["mine", "start"]),
        1 => guided_gpu_mine_start()?,
        2 => guided_custom_mine_start()?,
        3 => args(&["mine", "status"]),
        _ => vec![],
    })
}

fn guided_gpu_mine_start() -> Result<Vec<String>> {
    let backends = ["opencl (AMD)", "cuda (NVIDIA)", "metal (Apple)"];
    let Some(idx) = select("GPU Backend", &backends)? else {
        return Ok(vec![]);
    };

    let backend = match idx {
        0 => "opencl",
        1 => "cuda",
        2 => "metal",
        _ => "opencl",
    };

    let worker = optional_input("Worker name (blank = worker-1)", Some("worker-1"))?;

    let mut argv = args(&["mine", "start"]);
    argv.push("--backend".into());
    argv.push(backend.into());
    if !worker.trim().is_empty() && worker != "worker-1" {
        argv.push("--worker".into());
        argv.push(worker);
    }
    Ok(argv)
}

fn guided_custom_mine_start() -> Result<Vec<String>> {
    let pool = optional_input("Pool host:port (blank = default)", None)?;
    let wallet = optional_input("Wallet override (blank = config)", None)?;
    let worker = optional_input("Worker name (blank = worker-1)", Some("worker-1"))?;

    let algos = [
        "deeksha_lite_v1 (default, balanced)",
        "cosmic_harmony_ekam_deeksha_v2 (heavy)",
        "deeksha_lite_fire (thermal, high power)",
    ];
    let Some(algo_idx) = select("Algorithm", &algos)? else {
        return Ok(vec![]);
    };
    let algorithm = match algo_idx {
        1 => "cosmic_harmony_ekam_deeksha_v2",
        2 => "deeksha_lite_fire",
        _ => "deeksha_lite_v1",
    };

    let backends = ["cpu", "opencl (AMD)", "cuda (NVIDIA)", "metal (Apple)"];
    let Some(be_idx) = select("Backend", &backends)? else {
        return Ok(vec![]);
    };
    let backend = match be_idx {
        1 => "opencl",
        2 => "cuda",
        3 => "metal",
        _ => "cpu",
    };

    let mut argv = args(&["mine", "start"]);
    argv.push("--algorithm".into());
    argv.push(algorithm.into());
    argv.push("--backend".into());
    argv.push(backend.into());
    if !pool.trim().is_empty() {
        argv.push("--pool".into());
        argv.push(pool);
    }
    if !wallet.trim().is_empty() {
        argv.push("--wallet".into());
        argv.push(wallet);
    }
    if !worker.trim().is_empty() && worker != "worker-1" {
        argv.push("--worker".into());
        argv.push(worker);
    }
    Ok(argv)
}

// ─── Wallet Menu ──────────────────────────────────────────────────────────────

fn wallet_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = [
            "Create new wallet (mnemonic)",
            "Create new wallet (raw keypair)",
            "Import mnemonic",
            "Import secret key (hex)",
            "Show wallet address",
            "Check balance",
            "Check balance (custom address)",
            "Send ZION",
            "Wallet file info",
            "Reveal wallet secrets",
            "Export wallet JSON",
            BACK,
        ];

        let Some(choice) = select("Wallet", &items)? else {
            return Ok(None);
        };

        let argv = match choice {
            0 => {
                let out = optional_input("Output file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                let set_default = confirm("Set as default miner wallet?")?;
                let mut argv = args_owned(vec!["wallet".into(), "new".into(), "--mnemonic".into(), "--out".into(), out, "--print".into()]);
                if set_default { argv.push("--set-default".into()); }
                Some(argv)
            }
            1 => {
                let out = optional_input("Output file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                let set_default = confirm("Set as default miner wallet?")?;
                let mut argv = args_owned(vec!["wallet".into(), "new".into(), "--out".into(), out, "--print".into()]);
                if set_default { argv.push("--set-default".into()); }
                Some(argv)
            }
            2 => {
                let mnemonic = required_input("Mnemonic words", None)?;
                let out = optional_input("Output file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                let set_default = confirm("Set as default miner wallet?")?;
                let mut argv = args_owned(vec!["wallet".into(), "import-mnemonic".into(), "--mnemonic".into(), mnemonic, "--out".into(), out, "--print".into()]);
                if set_default { argv.push("--set-default".into()); }
                Some(argv)
            }
            3 => {
                let sk = required_input("Secret key hex (64 chars)", None)?;
                let out = optional_input("Output file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                let set_default = confirm("Set as default miner wallet?")?;
                let mut argv = args_owned(vec!["wallet".into(), "import-secret-key".into(), "--secret-key-hex".into(), sk, "--out".into(), out, "--print".into()]);
                if set_default { argv.push("--set-default".into()); }
                Some(argv)
            }
            4 => Some(args(&["wallet", "address"])),
            5 => Some(args(&["wallet", "balance"])),
            6 => {
                let address = required_input("Address", None)?;
                Some(args_owned(vec!["wallet".into(), "balance".into(), "--address".into(), address]))
            }
            7 => guided_wallet_send()?,
            8 => {
                let wallet = optional_input("Wallet file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                Some(args_owned(vec!["wallet".into(), "info".into(), "--wallet".into(), wallet]))
            }
            9 => {
                let wallet = optional_input("Wallet file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                let pw_env = optional_input("Password env var (blank = none)", None)?;
                let mut argv = args_owned(vec!["wallet".into(), "reveal".into(), "--wallet".into(), wallet]);
                if !pw_env.trim().is_empty() {
                    argv.push("--password-env".into());
                    argv.push(pw_env);
                }
                Some(argv)
            }
            10 => {
                let wallet = optional_input("Wallet file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;
                Some(args_owned(vec!["wallet".into(), "export".into(), "--wallet".into(), wallet]))
            }
            _ => return Ok(None),
        };

        if let Some(a) = argv {
            return Ok(Some(a));
        }
    }
}

fn guided_wallet_send() -> Result<Option<Vec<String>>> {
    let to = required_input("Recipient address (zion1...)", None)?;
    let amount = required_input("Amount in ZION", None)?;
    let memo = optional_input("Memo (optional, blank = none)", None)?;
    let wallet = optional_input("Wallet file (blank = zion-wallet.json)", Some("zion-wallet.json"))?;

    let mut argv = args_owned(vec![
        "wallet".into(),
        "send".into(),
        "--to".into(),
        to,
        "--amount".into(),
        amount,
        "--wallet".into(),
        wallet,
    ]);
    if !memo.trim().is_empty() {
        argv.push("--memo".into());
        argv.push(memo);
    }
    Ok(Some(argv))
}

// ─── Node Menu ────────────────────────────────────────────────────────────────

fn node_menu() -> Result<Option<Vec<String>>> {
    let items = [
        "Node info (version, network, peers)",
        "Chain info (height, tip, mempool)",
        "Connected peers",
        "Supply info (total, mined, remaining)",
        "Mempool details",
        BACK,
    ];

    let Some(choice) = select("Node (read-only)", &items)? else {
        return Ok(None);
    };

    Ok(match choice {
        0 => Some(args(&["node", "info"])),
        1 => Some(args(&["node", "chain"])),
        2 => Some(args(&["node", "peers"])),
        3 => Some(args(&["node", "supply"])),
        4 => Some(args(&["node", "mempool"])),
        _ => None,
    })
}

// ─── Mine Menu ────────────────────────────────────────────────────────────────

fn mine_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = [
            "Start mining (quick — CPU, pool mode)",
            "Start mining (GPU guided)",
            "Start mining (custom guided)",
            "Miner status",
            "Stop miner",
            BACK,
        ];

        let Some(choice) = select("Mining", &items)? else {
            return Ok(None);
        };

        let argv = match choice {
            0 => Some(args(&["mine", "start"])),
            1 => Some(guided_gpu_mine_start()?),
            2 => Some(guided_custom_mine_start()?),
            3 => Some(args(&["mine", "status"])),
            4 => Some(args(&["mine", "stop"])),
            _ => return Ok(None),
        };

        if let Some(a) = argv {
            return Ok(Some(a));
        }
    }
}

// ─── AI Menu ──────────────────────────────────────────────────────────────────

fn ai_menu() -> Result<Option<Vec<String>>> {
    let items = [
        "Chat with Hiran (interactive)",
        "Ask one question",
        "Hiran AI status",
        BACK,
    ];

    let Some(choice) = select("Hiran AI", &items)? else {
        return Ok(None);
    };

    Ok(match choice {
        0 => Some(args(&["ai", "chat"])),
        1 => {
            let question = required_input("Your question", None)?;
            Some(args_owned(vec!["ai".into(), "ask".into(), question]))
        }
        2 => Some(args(&["ai", "status"])),
        _ => None,
    })
}

// ─── Config Menu ──────────────────────────────────────────────────────────────

fn config_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = [
            "Set miner wallet address",
            "Set node RPC endpoint",
            "Set pool endpoint",
            "Set AI endpoint",
            "Set miner algorithm",
            "Set miner backend",
            "Set worker name",
            "Show config file path",
            BACK,
        ];

        let Some(choice) = select("Config", &items)? else {
            return Ok(None);
        };

        let argv = match choice {
            0 => {
                let val = required_input("Wallet address (zion1...)", None)?;
                Some(args_owned(vec!["config".into(), "set".into(), "miner.wallet".into(), val]))
            }
            1 => {
                let host = required_input("RPC host", Some("77.42.71.94"))?;
                Some(args_owned(vec!["config".into(), "set".into(), "node.rpc_host".into(), host]))
            }
            2 => {
                let host = required_input("Pool host", Some("77.42.71.94"))?;
                Some(args_owned(vec!["config".into(), "set".into(), "pool.host".into(), host]))
            }
            3 => {
                let url = required_input("AI endpoint URL", Some("http://77.42.71.94:8080"))?;
                Some(args_owned(vec!["config".into(), "set".into(), "ai.url".into(), url]))
            }
            4 => {
                let algos = ["deeksha_lite_v1", "cosmic_harmony_ekam_deeksha_v2", "deeksha_lite_fire"];
                let Some(idx) = select("Algorithm", &algos)? else {
                    return Ok(None);
                };
                Some(args_owned(vec!["config".into(), "set".into(), "miner.algorithm".into(), algos[idx].into()]))
            }
            5 => {
                let backends = ["cpu", "opencl", "cuda", "metal"];
                let Some(idx) = select("Backend", &backends)? else {
                    return Ok(None);
                };
                Some(args_owned(vec!["config".into(), "set".into(), "miner.backend".into(), backends[idx].into()]))
            }
            6 => {
                let name = required_input("Worker name", Some("worker-1"))?;
                Some(args_owned(vec!["config".into(), "set".into(), "miner.worker_name".into(), name]))
            }
            7 => Some(args(&["config", "path"])),
            _ => return Ok(None),
        };

        if let Some(a) = argv {
            return Ok(Some(a));
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn select(prompt: &str, items: &[&str]) -> Result<Option<usize>> {
    Ok(Select::with_theme(&ColorfulTheme::default())
        .with_prompt(prompt)
        .items(items)
        .default(0)
        .interact_opt()?)
}

fn required_input(prompt: &str, initial: Option<&str>) -> Result<String> {
    let theme = ColorfulTheme::default();
    let mut input = Input::<String>::with_theme(&theme).with_prompt(prompt);
    if let Some(initial) = initial {
        input = input.default(initial.to_string());
    }
    Ok(input.interact_text()?)
}

fn optional_input(prompt: &str, initial: Option<&str>) -> Result<String> {
    let theme = ColorfulTheme::default();
    let mut input = Input::<String>::with_theme(&theme)
        .with_prompt(prompt)
        .allow_empty(true);
    if let Some(initial) = initial {
        input = input.default(initial.to_string());
    }
    Ok(input.interact_text()?)
}

fn confirm(prompt: &str) -> Result<bool> {
    let theme = ColorfulTheme::default();
    let items = ["Yes", "No"];
    let choice = Select::with_theme(&theme)
        .with_prompt(prompt)
        .items(&items)
        .default(0)
        .interact_opt()?;
    Ok(choice == Some(0))
}

fn wait_enter(prompt: &str) -> Result<()> {
    use std::io::{self, Write};
    print!("\n  {} ", prompt.dimmed());
    io::stdout().flush()?;
    let mut line = String::new();
    io::stdin().read_line(&mut line)?;
    Ok(())
}

fn args(parts: &[&str]) -> Vec<String> {
    let mut argv = vec!["zion".to_string()];
    argv.extend(parts.iter().map(|p| (*p).to_string()));
    argv
}

fn args_owned(parts: Vec<String>) -> Vec<String> {
    let mut argv = vec!["zion".to_string()];
    argv.extend(parts);
    argv
}
