#!/usr/bin/env python3
"""Deploy a loopback-only vLLM container on an already-rented Vast instance."""

from __future__ import annotations

import argparse
import math
import re
import shlex
import subprocess
import sys

import vastctl

DEFAULT_CONTAINER = "hiran-vllm"
DEFAULT_VLLM_IMAGE = "vllm/vllm-openai:v0.8.5"
DEFAULT_GPU_MEMORY_UTILIZATION = 0.6
DEFAULT_MAX_MODEL_LEN = 8192
REMOTE_API_PORT = 8000
SSH_TIMEOUT_SECONDS = 1800
SSH_OPTIONS = [
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=8",
    "-o", "BatchMode=yes",
    "-o", "LogLevel=ERROR",
]


def validate_container_name(name: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,62}", name):
        raise ValueError("container name must be 1-63 safe ASCII characters")
    return name


def validate_gpu_memory_utilization(value: float) -> float:
    if not math.isfinite(value) or not 0.05 <= value <= 0.95:
        raise ValueError("GPU memory utilization must be between 0.05 and 0.95")
    return value


def validate_port(port: int) -> int:
    if not 1 <= port <= 65535:
        raise ValueError("port must be between 1 and 65535")
    return port


def validate_model_id(model: str) -> str:
    if len(model) > 200 or not re.fullmatch(
            r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", model):
        raise ValueError("model must be a Hugging Face org/model ID")
    return model


def validate_image(image: str) -> str:
    tag_match = re.fullmatch(
        r"vllm/vllm-openai:([A-Za-z0-9][A-Za-z0-9._-]*)", image
    )
    digest_match = re.fullmatch(r"vllm/vllm-openai@sha256:[a-fA-F0-9]{64}", image)
    if not tag_match and not digest_match:
        raise ValueError("image must be an official vllm/vllm-openai tag or digest")
    if tag_match and tag_match.group(1) == "latest":
        raise ValueError("the mutable :latest image tag is not allowed")
    return image


def get_running_instance(instance_id: str) -> dict:
    if not re.fullmatch(r"[0-9]+", instance_id):
        raise ValueError("instance ID must contain digits only")

    matches = [instance for instance in vastctl.instances()
               if str(instance.get("id")) == instance_id]
    if not matches:
        raise ValueError(f"Vast instance {instance_id} was not found")
    instance = matches[0]
    if str(instance.get("actual_status", "")).lower() != "running":
        raise ValueError(
            f"Vast instance {instance_id} is not running; "
            "no rental or start action was attempted"
        )

    host = instance.get("ssh_host")
    if not isinstance(host, str) or not re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9.-]*", host):
        raise ValueError(f"Vast instance {instance_id} has no safe SSH host")
    try:
        port = int(instance.get("ssh_port"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Vast instance {instance_id} has no valid SSH port") from exc
    if not 1 <= port <= 65535:
        raise ValueError(f"Vast instance {instance_id} has no valid SSH port")

    return {**instance, "ssh_host": host, "ssh_port": port}


def remote_ssh_command(instance: dict, script: str) -> list[str]:
    return [
        "ssh", *SSH_OPTIONS, "-p", str(instance["ssh_port"]),
        f"root@{instance['ssh_host']}", script,
    ]


def build_deploy_script(args: argparse.Namespace) -> str:
    name = validate_container_name(args.name)
    port = validate_port(args.port)
    utilization = validate_gpu_memory_utilization(args.gpu_memory_utilization)
    if args.max_model_len < 1:
        raise ValueError("max model length must be positive")
    model = validate_model_id(args.model)
    image = validate_image(args.image)

    docker_args = [
        "docker", "run", "-d", "--name", name, "--restart", "unless-stopped",
        "--gpus", "all", "--ipc=host",
        "-p", f"127.0.0.1:{port}:{REMOTE_API_PORT}",
        image, "--model", model,
        "--host", "0.0.0.0", "--port", str(REMOTE_API_PORT),
        "--gpu-memory-utilization", f"{utilization:g}",
        "--max-model-len", str(args.max_model_len),
    ]
    return "\n".join([
        "set -eu",
        "command -v docker >/dev/null 2>&1 || { echo 'Docker is required' >&2; exit 127; }",
        "command -v nvidia-smi >/dev/null 2>&1 || { echo 'NVIDIA GPU is required' >&2; exit 127; }",
        f"if docker inspect {shlex.quote(name)} >/dev/null 2>&1; then",
        f"  echo 'Container {name} already exists; stop/remove it explicitly first' >&2",
        "  exit 17",
        "fi",
        f"exec {shlex.join(docker_args)}",
    ])


def build_status_script(name: str, port: int) -> str:
    name = validate_container_name(name)
    port = validate_port(port)
    return "\n".join([
        "set -eu",
        f"docker inspect --format '{{{{.State.Status}}}}' {shlex.quote(name)}",
        f"if ! curl -fsS --max-time 5 http://127.0.0.1:{port}/v1/models; then",
        "  echo 'Inference API is not ready or unreachable' >&2",
        "  exit 1",
        "fi",
    ])


def build_stop_script(name: str) -> str:
    name = validate_container_name(name)
    return f"set -eu; docker stop {shlex.quote(name)}"


def confirm_deploy(args: argparse.Namespace, instance: dict) -> bool:
    if args.yes:
        return True
    if not sys.stdin.isatty():
        raise ValueError("use --yes to confirm deployment in a non-interactive shell")
    hourly_cost = instance.get("dph_total")
    cost_note = (f" (instance price ${hourly_cost}/h)" if hourly_cost is not None else "")
    answer = input(
        f"Start vLLM model {args.model!r} on Vast instance {args.instance_id}"
        f"{cost_note}? This uses GPU compute and may reduce mining performance [y/N] "
    )
    return answer.strip().lower() in {"y", "yes"}


def execute_ssh(instance: dict, script: str, timeout: int = SSH_TIMEOUT_SECONDS) -> int:
    try:
        result = subprocess.run(
            remote_ssh_command(instance, script),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        print(f"SSH command timed out after {timeout} seconds", file=sys.stderr)
        return 124
    except FileNotFoundError as exc:
        print(f"SSH client is unavailable: {exc}", file=sys.stderr)
        return 127

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode


def print_tunnel(instance: dict, local_port: int, remote_port: int) -> None:
    print(tunnel_command(instance, local_port, remote_port))
    print(f"Then configure Hiran with: LLM_BASE_URL=http://127.0.0.1:{local_port}/v1")


def tunnel_command(instance: dict, local_port: int, remote_port: int) -> str:
    local_port = validate_port(local_port)
    remote_port = validate_port(remote_port)
    args = [
        "ssh", *SSH_OPTIONS, "-N",
        "-L", f"{local_port}:127.0.0.1:{remote_port}",
        "-p", str(instance["ssh_port"]), f"root@{instance['ssh_host']}",
    ]
    return shlex.join(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)

    deploy = subcommands.add_parser(
        "deploy", help="start a loopback-only vLLM container on a running instance"
    )
    deploy.add_argument("instance_id")
    deploy.add_argument("--model", required=True, help="Hugging Face model ID")
    deploy.add_argument("--image", default=DEFAULT_VLLM_IMAGE,
                        help="Official version-tagged vLLM image (not :latest)")
    deploy.add_argument("--name", default=DEFAULT_CONTAINER)
    deploy.add_argument("--port", type=int, default=REMOTE_API_PORT,
                        help="loopback-only host port on the Vast instance")
    deploy.add_argument("--gpu-memory-utilization", type=float,
                        default=DEFAULT_GPU_MEMORY_UTILIZATION)
    deploy.add_argument("--max-model-len", type=int, default=DEFAULT_MAX_MODEL_LEN)
    deploy.add_argument("--yes", action="store_true",
                        help="confirm GPU use without an interactive prompt")

    status = subcommands.add_parser("status", help="show container and API status")
    status.add_argument("instance_id")
    status.add_argument("--name", default=DEFAULT_CONTAINER)
    status.add_argument("--port", type=int, default=REMOTE_API_PORT)

    stop = subcommands.add_parser("stop", help="stop the inference container")
    stop.add_argument("instance_id")
    stop.add_argument("--name", default=DEFAULT_CONTAINER)

    tunnel = subcommands.add_parser("tunnel", help="print a local SSH port-forward command")
    tunnel.add_argument("instance_id")
    tunnel.add_argument("--local-port", type=int, default=REMOTE_API_PORT)
    tunnel.add_argument("--remote-port", type=int, default=REMOTE_API_PORT)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        instance = get_running_instance(args.instance_id)
        if args.command == "deploy":
            script = build_deploy_script(args)
            if not confirm_deploy(args, instance):
                print("Deployment cancelled.")
                return 0
        elif args.command == "status":
            script = build_status_script(args.name, args.port)
        elif args.command == "stop":
            script = build_stop_script(args.name)
        else:
            print_tunnel(instance, args.local_port, args.remote_port)
            return 0
    except ValueError as exc:
        parser.error(str(exc))

    return execute_ssh(instance, script)


if __name__ == "__main__":
    sys.exit(main())
