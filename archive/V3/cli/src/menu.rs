use anyhow::Result;
use dialoguer::{theme::ColorfulTheme, Input, Select};

use crate::ui;

const BACK: &str = "<- Back";
const EXIT: &str = "Exit";

pub fn run(show_genesis: bool) -> Result<Option<Vec<String>>> {
    print_intro(show_genesis);

    loop {
        let items = [
            "Health & fast checks",
            "Stack operations",
            "L1 node & pool",
            "Mining & wallet",
            "L2 bridge & DAO",
            "L3 agent, warp & NCL",
            "Onboarding",
            EXIT,
        ];

        let Some(choice) = select("ZION operator dashboard", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => quick_status_menu()?,
            1 => stack_operations_menu()?,
            2 => l1_menu()?,
            3 => mining_wallet_menu()?,
            4 => l2_menu()?,
            5 => l3_menu()?,
            6 => Some(args(&["onboard"])),
            7 => return Ok(None),
            _ => None,
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn print_intro(show_genesis: bool) {
    if show_genesis {
        ui::print_genesis_banner();
    } else {
        ui::print_header("ZION operator dashboard");
    }
    ui::print_info("Arrow keys navigate, Enter runs, Esc leaves the current menu.");
    ui::print_row("Health", "doctor, status, node, pool, agent");
    ui::print_row("Stack", "services, deploy, config, version, update");
    ui::print_row("L1", "node and pool inspection");
    ui::print_row("Mine", "miner start, bench, stop, wallet send");
    ui::print_row("L2", "bridge transfers and dao vote paths");
    ui::print_row("L3", "agent, warp, ncl orchestration");
    println!();
}

fn stack_operations_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = [
            "Service lifecycle",
            "Guided deploy",
            "Config",
            "Views & TUI",
            "Version & release info",
            "Auto update CLI",
            BACK,
        ];

        let Some(choice) = select("Stack operations", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => service_menu()?,
            1 => Some(guided_deploy_workflow()?),
            2 => config_menu()?,
            3 => views_menu()?,
            4 => Some(args(&["version"])),
            5 => Some(args(&["update"])),
            _ => return Ok(None),
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn l1_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = ["Node", "Pool", BACK];

        let Some(choice) = select("L1 node & pool", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => node_menu()?,
            1 => pool_menu()?,
            _ => return Ok(None),
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn mining_wallet_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = ["Mining", "Wallet", BACK];

        let Some(choice) = select("Mining & wallet", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => mine_menu()?,
            1 => wallet_menu()?,
            _ => return Ok(None),
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn l2_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = ["Bridge", "DAO", BACK];

        let Some(choice) = select("L2 bridge & DAO", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => bridge_menu()?,
            1 => dao_menu()?,
            _ => return Ok(None),
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn l3_menu() -> Result<Option<Vec<String>>> {
    loop {
        let items = ["Guided agent workflow", "Agent", "Warp", "NCL", BACK];

        let Some(choice) = select("L3 agent, warp & NCL", &items)? else {
            return Ok(None);
        };

        let selected = match choice {
            0 => Some(guided_agent_workflow()?),
            1 => agent_menu()?,
            2 => warp_menu()?,
            3 => ncl_menu()?,
            _ => return Ok(None),
        };

        if selected.is_some() {
            return Ok(selected);
        }
    }
}

fn quick_status_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "zion status",
            "zion doctor",
            "zion node status",
            "zion pool stats",
            "zion agent status",
            "zion bridge status",
            "zion dao status",
            "zion warp status",
            "zion ncl status",
            BACK,
        ];

        let Some(choice) = select("Quick status", &items)? else {
            return Ok(None);
        };

        Ok(match choice {
            0 => Some(args(&["status"])),
            1 => Some(args(&["doctor"])),
            2 => Some(args(&["node", "status"])),
            3 => Some(args(&["pool", "stats"])),
            4 => Some(args(&["agent", "status"])),
            5 => Some(args(&["bridge", "status"])),
            6 => Some(args(&["dao", "status"])),
            7 => Some(args(&["warp", "status"])),
            8 => Some(args(&["ncl", "status"])),
            _ => None,
        })
    }
}

fn service_menu() -> Result<Option<Vec<String>>> {
    let actions = ["start", "stop", "restart", "logs", BACK];
    let services = [
        "all",
        "node",
        "pool",
        "miner",
        "agent",
        "bridge",
        "dao",
        "website",
        "redis",
        "monitoring",
        BACK,
    ];

    let Some(action_idx) = select("Service lifecycle", &actions)? else {
        return Ok(None);
    };
    if actions[action_idx] == BACK {
        return Ok(None);
    }

    let Some(service_idx) = select("Target service", &services)? else {
        return Ok(None);
    };
    if services[service_idx] == BACK {
        return Ok(None);
    }

    Ok(Some(args(&[actions[action_idx], services[service_idx]])))
}

fn node_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Peers",
            "Last 10 blocks",
            "Custom block range",
            "Block by height/hash",
            "Transaction lookup",
            "Mempool",
            "Sync peers",
            "Raw JSON-RPC call",
            BACK,
        ];

        let Some(choice) = select("Node", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["node", "status"]))),
            1 => Ok(Some(args(&["node", "peers"]))),
            2 => Ok(Some(args(&["node", "blocks", "10"]))),
            3 => {
                let n = required_input("How many recent blocks?", Some("25"))?;
                Ok(Some(args_owned(vec!["node".into(), "blocks".into(), n])))
            }
            4 => {
                let id = required_input("Block height or hash", None)?;
                Ok(Some(args_owned(vec!["node".into(), "block".into(), id])))
            }
            5 => {
                let txid = required_input("Transaction ID", None)?;
                Ok(Some(args_owned(vec!["node".into(), "tx".into(), txid])))
            }
            6 => Ok(Some(args(&["node", "mempool"]))),
            7 => Ok(Some(args(&["node", "sync"]))),
            8 => {
                let method = required_input("RPC method", Some("getChainInfo"))?;
                let params = optional_input("Params JSON (blank = {})", Some("{}"))?;
                let params = if params.trim().is_empty() {
                    "{}".to_string()
                } else {
                    params
                };
                Ok(Some(args_owned(vec![
                    "node".into(),
                    "rpc".into(),
                    method,
                    params,
                ])))
            }
            _ => Ok(None),
        }
    }
}

fn pool_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Stats",
            "Active miners",
            "Config",
            "Earnings for current wallet",
            "Earnings for custom address",
            BACK,
        ];
        let Some(choice) = select("Pool", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["pool", "stats"]))),
            1 => Ok(Some(args(&["pool", "miners"]))),
            2 => Ok(Some(args(&["pool", "config"]))),
            3 => Ok(Some(args(&["pool", "earnings"]))),
            4 => {
                let address = required_input("Wallet address", None)?;
                Ok(Some(args_owned(vec![
                    "pool".into(),
                    "earnings".into(),
                    "--address".into(),
                    address,
                ])))
            }
            _ => Ok(None),
        }
    }
}

fn mine_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Start mining (quick default)",
            "Start mining (guided)",
            "Miner status",
            "CPU benchmark",
            "GPU benchmark",
            "Ekam benchmark",
            "Stop miner",
            "DCR status",
            "DCR start",
            "DCR stop",
            BACK,
        ];

        let Some(choice) = select("Mining", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["mine", "start"]))),
            1 => Ok(Some(guided_mine_start()?)),
            2 => Ok(Some(args(&["mine", "status"]))),
            3 => Ok(Some(args(&["mine", "bench"]))),
            4 => {
                let mut argv = args(&["mine", "bench", "--gpu"]);
                apply_backend_flag(&mut argv, choose_gpu_backend(false)?);
                apply_optional_flag(
                    &mut argv,
                    "--work-size",
                    optional_input("Work size (blank = default)", None)?,
                );
                apply_optional_flag(
                    &mut argv,
                    "--secs",
                    optional_input("Duration seconds (blank = 5)", Some("5"))?,
                );
                Ok(Some(argv))
            }
            5 => {
                let mut argv = args(&["mine", "bench", "--ekam"]);
                apply_backend_flag(&mut argv, choose_gpu_backend(true)?);
                apply_optional_flag(
                    &mut argv,
                    "--work-size",
                    optional_input("Work size (blank = default)", None)?,
                );
                apply_optional_flag(
                    &mut argv,
                    "--secs",
                    optional_input("Duration seconds (blank = 5)", Some("5"))?,
                );
                Ok(Some(argv))
            }
            6 => Ok(Some(args(&["mine", "stop"]))),
            7 => Ok(Some(args(&["mine", "dcr", "status"]))),
            8 => Ok(Some(args(&["mine", "dcr", "start"]))),
            9 => Ok(Some(args(&["mine", "dcr", "stop"]))),
            _ => Ok(None),
        }
    }
}

fn wallet_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Current wallet address",
            "Current wallet balance",
            "Custom address balance",
            "Send ZION",
            "Generate wallet stub",
            "Tithe info",
            BACK,
        ];
        let Some(choice) = select("Wallet", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["wallet", "address"]))),
            1 => Ok(Some(args(&["wallet", "balance"]))),
            2 => {
                let address = required_input("Address", None)?;
                Ok(Some(args_owned(vec![
                    "wallet".into(),
                    "balance".into(),
                    "--address".into(),
                    address,
                ])))
            }
            3 => Ok(Some(guided_wallet_send()?)),
            4 => Ok(Some(args(&["wallet", "new"]))),
            5 => Ok(Some(args(&["wallet", "tithe"]))),
            _ => Ok(None),
        }
    }
}

fn agent_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Chat REPL",
            "Ask one question",
            "Logs",
            "Config",
            "Tasks",
            "Memory list",
            "Memory flush",
            "RAG reindex",
            "RAG query",
            "Warp integration",
            "NCL integration",
            "Oasis bridge status",
            BACK,
        ];
        let Some(choice) = select("Agent", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["agent", "status"]))),
            1 => Ok(Some(args(&["agent", "chat"]))),
            2 => {
                let question = required_input("Question", None)?;
                Ok(Some(args_owned(vec![
                    "agent".into(),
                    "ask".into(),
                    question,
                ])))
            }
            3 => Ok(Some(args(&["agent", "logs"]))),
            4 => Ok(Some(args(&["agent", "config"]))),
            5 => Ok(Some(args(&["agent", "tasks"]))),
            6 => Ok(Some(args(&["agent", "memory", "ls"]))),
            7 => Ok(Some(args(&["agent", "memory", "flush"]))),
            8 => Ok(Some(args(&["agent", "rag", "index"]))),
            9 => {
                let question = required_input("RAG query", None)?;
                Ok(Some(args_owned(vec![
                    "agent".into(),
                    "rag".into(),
                    "query".into(),
                    question,
                ])))
            }
            10 => Ok(Some(args(&["agent", "warp"]))),
            11 => Ok(Some(args(&["agent", "ncl"]))),
            12 => Ok(Some(args(&["agent", "oasis"]))),
            _ => Ok(None),
        }
    }
}

fn bridge_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Pending",
            "History (last 10)",
            "History (custom)",
            "Get transfer",
            "Chains",
            "Transfer dry-run",
            BACK,
        ];
        let Some(choice) = select("Bridge", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["bridge", "status"]))),
            1 => Ok(Some(args(&["bridge", "pending"]))),
            2 => Ok(Some(args(&["bridge", "history", "10"]))),
            3 => {
                let n = required_input("History limit", Some("25"))?;
                Ok(Some(args_owned(vec!["bridge".into(), "history".into(), n])))
            }
            4 => {
                let id = required_input("Transfer ID", None)?;
                Ok(Some(args_owned(vec!["bridge".into(), "get".into(), id])))
            }
            5 => Ok(Some(args(&["bridge", "chains"]))),
            6 => Ok(Some(guided_bridge_transfer()?)),
            _ => Ok(None),
        }
    }
}

fn dao_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Active proposals",
            "Proposal detail",
            "Treasury",
            "Params",
            "Vote dry-run",
            BACK,
        ];
        let Some(choice) = select("DAO", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["dao", "status"]))),
            1 => Ok(Some(args(&["dao", "proposals"]))),
            2 => {
                let id = required_input("Proposal ID", None)?;
                Ok(Some(args_owned(vec!["dao".into(), "proposal".into(), id])))
            }
            3 => Ok(Some(args(&["dao", "treasury"]))),
            4 => Ok(Some(args(&["dao", "params"]))),
            5 => Ok(Some(guided_dao_vote()?)),
            _ => Ok(None),
        }
    }
}

fn warp_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Chains",
            "Chain detail",
            "Pending",
            "Get message",
            "Stats",
            "Validators",
            BACK,
        ];
        let Some(choice) = select("Warp", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["warp", "status"]))),
            1 => Ok(Some(args(&["warp", "chains"]))),
            2 => {
                let chain_id = required_input("Chain ID", None)?;
                Ok(Some(args_owned(vec![
                    "warp".into(),
                    "chain".into(),
                    chain_id,
                ])))
            }
            3 => Ok(Some(args(&["warp", "pending"]))),
            4 => {
                let id = required_input("Message ID", None)?;
                Ok(Some(args_owned(vec!["warp".into(), "get".into(), id])))
            }
            5 => Ok(Some(args(&["warp", "stats"]))),
            6 => {
                let chain_id = required_input("Chain ID", None)?;
                Ok(Some(args_owned(vec![
                    "warp".into(),
                    "validators".into(),
                    chain_id,
                ])))
            }
            _ => Ok(None),
        }
    }
}

fn ncl_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Status",
            "Jobs",
            "Job detail",
            "Workers",
            "Leaderboard",
            "Schedule",
            "Price",
            "Submit job",
            BACK,
        ];
        let Some(choice) = select("NCL", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["ncl", "status"]))),
            1 => Ok(Some(args(&["ncl", "jobs"]))),
            2 => {
                let id = required_input("Job ID", None)?;
                Ok(Some(args_owned(vec!["ncl".into(), "job".into(), id])))
            }
            3 => Ok(Some(args(&["ncl", "workers"]))),
            4 => Ok(Some(args(&["ncl", "leaderboard"]))),
            5 => Ok(Some(args(&["ncl", "schedule"]))),
            6 => {
                let model = required_input("Model name", None)?;
                Ok(Some(args_owned(vec!["ncl".into(), "price".into(), model])))
            }
            7 => Ok(Some(guided_ncl_submit()?)),
            _ => Ok(None),
        }
    }
}

fn config_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Show config",
            "Config path",
            "Validate",
            "Init wizard",
            "Set key/value",
            BACK,
        ];
        let Some(choice) = select("Config", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["config", "show"]))),
            1 => Ok(Some(args(&["config", "path"]))),
            2 => Ok(Some(args(&["config", "validate"]))),
            3 => Ok(Some(args(&["config", "init"]))),
            4 => {
                let key = required_input("Config key", None)?;
                let value = required_input("Config value", None)?;
                Ok(Some(args_owned(vec![
                    "config".into(),
                    "set".into(),
                    key,
                    value,
                ])))
            }
            _ => Ok(None),
        }
    }
}

fn views_menu() -> Result<Option<Vec<String>>> {
    {
        let items = [
            "Dashboard in browser",
            "Block explorer TUI",
            "Live monitor TUI",
            "Deploy status",
            "Deploy server",
            "Deploy website",
            "Deploy update",
            BACK,
        ];
        let Some(choice) = select("Views & TUI", &items)? else {
            return Ok(None);
        };

        match choice {
            0 => Ok(Some(args(&["dashboard"]))),
            1 => Ok(Some(args(&["explorer"]))),
            2 => Ok(Some(args(&["monitor"]))),
            3 => Ok(Some(args(&["deploy", "status"]))),
            4 => Ok(Some(args(&["deploy", "server"]))),
            5 => Ok(Some(args(&["deploy", "website"]))),
            6 => Ok(Some(args(&["deploy", "update"]))),
            _ => Ok(None),
        }
    }
}

fn guided_deploy_workflow() -> Result<Vec<String>> {
    let items = [
        "Deploy full server stack",
        "Deploy website",
        "Refresh running containers",
        "Remote container status",
        "Open SSH session",
        "docker system prune",
    ];

    let Some(choice) = select("Guided deploy workflow", &items)? else {
        return Ok(args(&["deploy", "status"]));
    };

    Ok(match choice {
        0 => {
            let host = optional_input("Host override (blank = config default)", None)?;
            let mut argv = args(&["deploy", "server"]);
            apply_optional_flag(&mut argv, "--host", host);
            argv
        }
        1 => args(&["deploy", "website"]),
        2 => args(&["deploy", "update"]),
        3 => args(&["deploy", "status"]),
        4 => args(&["deploy", "ssh"]),
        5 => args(&["deploy", "prune"]),
        _ => args(&["deploy", "status"]),
    })
}

fn guided_agent_workflow() -> Result<Vec<String>> {
    let items = [
        "Agent status",
        "Ask one question",
        "RAG query",
        "Start agent",
        "Restart agent",
        "Stop agent",
        "Agent logs",
        "Agent config",
        "Agent tasks",
        "Memory list",
        "Memory flush",
        "Warp integration",
        "NCL integration",
        "Oasis bridge status",
    ];

    let Some(choice) = select("Guided agent workflow", &items)? else {
        return Ok(args(&["agent", "status"]));
    };

    Ok(match choice {
        0 => args(&["agent", "status"]),
        1 => {
            let question = required_input("Question for Hiranyagarbha", None)?;
            args_owned(vec!["agent".into(), "ask".into(), question])
        }
        2 => {
            let question = required_input("RAG query", None)?;
            args_owned(vec!["agent".into(), "rag".into(), "query".into(), question])
        }
        3 => args(&["agent", "start"]),
        4 => args(&["agent", "restart"]),
        5 => args(&["agent", "stop"]),
        6 => args(&["agent", "logs"]),
        7 => args(&["agent", "config"]),
        8 => args(&["agent", "tasks"]),
        9 => args(&["agent", "memory", "ls"]),
        10 => args(&["agent", "memory", "flush"]),
        11 => args(&["agent", "warp"]),
        12 => args(&["agent", "ncl"]),
        13 => args(&["agent", "oasis"]),
        _ => args(&["agent", "status"]),
    })
}

fn guided_mine_start() -> Result<Vec<String>> {
    let mut argv = args(&["mine", "start"]);
    let backend = choose_backend()?;
    let profile = choose_profile()?;

    apply_optional_flag(
        &mut argv,
        "--pool",
        optional_input("Pool host:port (blank = config)", None)?,
    );
    apply_optional_flag(
        &mut argv,
        "--wallet",
        optional_input("Wallet override (blank = config)", None)?,
    );
    apply_optional_flag(
        &mut argv,
        "--threads",
        optional_input("Threads (blank = auto)", None)?,
    );
    apply_backend_flag(&mut argv, backend);
    argv.push("--profile".into());
    argv.push(profile.into());
    Ok(argv)
}

fn guided_wallet_send() -> Result<Vec<String>> {
    let to = required_input("Recipient address", None)?;
    let amount = required_input("Amount in ZION", None)?;
    let memo = optional_input("Memo (optional)", None)?;

    let mut argv = args_owned(vec![
        "wallet".into(),
        "send".into(),
        "--to".into(),
        to,
        "--amount".into(),
        amount,
    ]);
    apply_optional_flag(&mut argv, "--memo", memo);
    Ok(argv)
}

fn guided_bridge_transfer() -> Result<Vec<String>> {
    let from_chain = required_input("From chain", Some("zion"))?;
    let to_chain = required_input("To chain", Some("base"))?;
    let amount = required_input("Amount", None)?;
    let token = required_input("Token", Some("ZION"))?;

    Ok(args_owned(vec![
        "bridge".into(),
        "transfer".into(),
        "--from-chain".into(),
        from_chain,
        "--to-chain".into(),
        to_chain,
        "--amount".into(),
        amount,
        "--token".into(),
        token,
    ]))
}

fn guided_dao_vote() -> Result<Vec<String>> {
    let proposal_id = required_input("Proposal ID", None)?;
    let votes = ["yes", "no", "abstain"];
    let Some(vote_idx) = select("Vote", &votes)? else {
        return Ok(args(&["dao", "status"]));
    };

    Ok(args_owned(vec![
        "dao".into(),
        "vote".into(),
        "--proposal-id".into(),
        proposal_id,
        "--vote".into(),
        votes[vote_idx].into(),
    ]))
}

fn guided_ncl_submit() -> Result<Vec<String>> {
    let model = required_input("Model", None)?;
    let input = required_input("Input prompt or payload", None)?;
    let max_price = optional_input("Max price in ZION (blank = 1.0)", Some("1.0"))?;

    let mut argv = args_owned(vec![
        "ncl".into(),
        "submit".into(),
        "--model".into(),
        model,
        "--input".into(),
        input,
    ]);
    apply_optional_flag(&mut argv, "--max-price", max_price);
    Ok(argv)
}

fn choose_backend() -> Result<Option<&'static str>> {
    let items = ["auto", "cpu", "metal", "opencl", "cuda"];
    let Some(choice) = select("Mining backend", &items)? else {
        return Ok(None);
    };
    Ok(match items[choice] {
        "auto" => None,
        other => Some(other),
    })
}

fn choose_gpu_backend(allow_auto: bool) -> Result<Option<&'static str>> {
    let items: Vec<&str> = if allow_auto {
        vec!["auto", "metal", "opencl", "cuda"]
    } else {
        vec!["auto", "gpu", "metal", "opencl", "cuda"]
    };
    let Some(choice) = select("GPU backend", &items)? else {
        return Ok(None);
    };
    Ok(match items[choice] {
        "auto" => None,
        other => Some(other),
    })
}

fn choose_profile() -> Result<&'static str> {
    let items = ["pool", "solo", "benchmark", "dual"];
    let Some(choice) = select("Mining profile", &items)? else {
        return Ok("pool");
    };
    Ok(items[choice])
}

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

fn apply_optional_flag(argv: &mut Vec<String>, flag: &str, value: String) {
    if !value.trim().is_empty() {
        argv.push(flag.into());
        argv.push(value);
    }
}

fn apply_backend_flag(argv: &mut Vec<String>, backend: Option<&str>) {
    if let Some(backend) = backend {
        argv.push("--backend".into());
        argv.push(backend.into());
    }
}

fn args(parts: &[&str]) -> Vec<String> {
    let mut argv = vec!["zion".to_string()];
    argv.extend(parts.iter().map(|part| (*part).to_string()));
    argv
}

fn args_owned(parts: Vec<String>) -> Vec<String> {
    let mut argv = vec!["zion".to_string()];
    argv.extend(parts);
    argv
}
