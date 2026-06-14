import os
os.environ['HF_HOME'] = '/workspace/.cache/huggingface'
os.environ['TRANSFORMERS_CACHE'] = '/workspace/.cache/huggingface'

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

print('Downloading Qwen3-32B base model...')
print('This will take ~1-2 hours and ~60 GB...')

tok = AutoTokenizer.from_pretrained('Qwen/Qwen3-32B', trust_remote_code=True)
print('Tokenizer downloaded')

model = AutoModelForCausalLM.from_pretrained(
    'Qwen/Qwen3-32B',
    trust_remote_code=True,
    torch_dtype=torch.bfloat16,
    device_map='cpu'
)
print('Base model downloaded successfully!')

import subprocess
result = subprocess.run(['du', '-sh', '/workspace/.cache/huggingface'], capture_output=True, text=True)
print(f'Cache size: {result.stdout.strip()}')
