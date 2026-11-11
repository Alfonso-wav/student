"""Genera las imágenes de los vídeos con Z-Image Turbo (Apache 2.0).

Lo llama `scripts/images.ts`:

    uv run generate.py trabajos.json carpeta-salida

`trabajos.json`: lista de {"key": str, "prompt": str} (el prompt ya lleva el estilo común).
Escribe `<carpeta-salida>/<key>.webp`, 640×800 (4:5, vertical).

El transformer oficial está en fp32 (25 GB); se usa el mismo modelo en bf16 de un solo archivo
(Comfy-Org, 12 GB), guardado en fp8 en la GPU. Text encoder y transformer se cargan por turnos (RAM pico ~12 GB).
"""

import gc
import json
import sys
import time
from pathlib import Path

import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from huggingface_hub import hf_hub_download

GEN_W, GEN_H = 832, 1040
OUT_W, OUT_H = 640, 800
STEPS = 9


def main() -> None:
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    if not jobs:
        return
    # Fase 1: text encoder (Qwen3-4B, 8 GB) en la GPU para codificar todos los prompts; luego fuera.
    pipe = ZImagePipeline.from_pretrained("Tongyi-MAI/Z-Image-Turbo", transformer=None, torch_dtype=torch.bfloat16)
    pipe.text_encoder.to("cuda")
    with torch.no_grad():
        embeds = [pipe.encode_prompt(j["prompt"], device="cuda", do_classifier_free_guidance=False)[0] for j in jobs]
    embeds = [[e.cpu() for e in emb] for emb in embeds]
    # Liberar el text encoder del todo antes de cargar el transformer: si coinciden en RAM son ~20 GB.
    pipe.text_encoder = None
    gc.collect()
    torch.cuda.empty_cache()

    # Fase 2: transformer. En bf16 son 12,3 GB y no cabe en 12 GB de VRAM: se guarda en fp8 (~6 GB)
    # y calcula en bf16. (Con enable_model_cpu_offload + fp8, accelerate hace segfault en Windows.)
    ckpt = hf_hub_download("Comfy-Org/z_image_turbo", "split_files/diffusion_models/z_image_turbo_bf16.safetensors")
    transformer = ZImageTransformer2DModel.from_single_file(
        ckpt, torch_dtype=torch.bfloat16, config="Tongyi-MAI/Z-Image-Turbo", subfolder="transformer"
    )
    transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16)
    pipe.transformer = transformer.to("cuda")
    pipe.vae.to("cuda")

    for i, (job, emb) in enumerate(zip(jobs, embeds), 1):
        t = time.time()
        g = torch.Generator("cuda").manual_seed(1)
        img = pipe(
            prompt_embeds=[e.to("cuda") for e in emb], width=GEN_W, height=GEN_H,
            num_inference_steps=STEPS, guidance_scale=0.0, generator=g,
        ).images[0]
        img.resize((OUT_W, OUT_H)).save(out / f"{job['key']}.webp", quality=78, method=6)
        print(f"[{i}/{len(jobs)}] {job['key']} {time.time() - t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
