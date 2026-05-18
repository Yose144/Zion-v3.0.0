use zion_core::{BlockTemplate, RpcRequest, RpcResponse, NodeRuntime, NodeConfig};

fn main() {
    let mut runtime = NodeRuntime::new("nonce-finder", NodeConfig::mainnet());
    let template = runtime.active_template();
    println!("template_id={}", template.template_id);
    println!("header_hex={}", template.header_hex);
    println!("target_hex={}", template.target_hex);
    println!("difficulty={}", template.difficulty);

    let nonce = find_valid_nonce(&template);
    println!("FOUND nonce={}", nonce);

    let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
        template_id: template.template_id,
        header_hex: template.header_hex.clone(),
        nonce,
        target_hex: template.target_hex.clone(),
    });
    println!("submit_response={:?}", response);
}
