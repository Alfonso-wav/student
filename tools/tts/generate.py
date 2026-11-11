"""Genera la narración de los vídeos con Chatterbox Multilingual es-ES.

Lo llama `scripts/tts.ts`; no hace falta usarlo a mano.

    uv run generate.py trabajos.json carpeta-salida

`trabajos.json` es una lista de {"key": str, "text": str}. Por cada trabajo escribe
`<carpeta-salida>/<key>.wav`. El texto ya llega con el léxico de pronunciación aplicado.

Chatterbox se degrada con textos largos, así que se genera frase a frase y se une con una pausa.
Cada clip se transcribe con Whisper; si la transcripción se aleja mucho del texto (palabras
comidas, frases repetidas, balbuceo) se vuelve a generar con otra semilla.
"""

import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

import jiwer
import torch
import torchaudio as ta
from huggingface_hub import hf_hub_download, snapshot_download

from chatterbox.mtl_tts import ChatterboxMultilingualTTS

HERE = Path(__file__).parent
REFERENCE = HERE / "voz-referencia.wav"
PAUSE_S = 0.35
MAX_TRIES = 3
# Whisper escribe cifras ("200.000") donde el texto dice "doscientas mil": un 15-20 % de diferencia
# es normal. Por encima de esto suele ser un fallo real del TTS.
MAX_WER = 0.35


def load_model() -> ChatterboxMultilingualTTS:
    base = snapshot_download(
        "ResembleAI/chatterbox",
        allow_patterns=["ve.pt", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json", "conds.pt", "Cangjie5_TC.json"],
    )
    ckpt = HERE / ".ckpt"
    ckpt.mkdir(exist_ok=True)
    for f in os.listdir(base):
        if not (ckpt / f).exists():
            shutil.copy(os.path.join(base, f), ckpt)
    t3 = ckpt / "t3_es_es.safetensors"
    if not t3.exists():
        shutil.copy(hf_hub_download("ResembleAI/Chatterbox-Multilingual-es-es", "t3_es_es.safetensors"), t3)
    model = ChatterboxMultilingualTTS.from_local(ckpt, "cuda", t3_model=t3.name)
    model.prepare_conditionals(str(REFERENCE))
    return model


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?…])\s+", text.strip())
    return [p for p in parts if p]


def words(t: str) -> str:
    return " ".join(re.sub(r"[^\wáéíóúñü ]", " ", t.lower()).split())


def synth(model: ChatterboxMultilingualTTS, text: str, seed: int) -> torch.Tensor:
    torch.manual_seed(seed)
    parts = []
    for s in sentences(text):
        parts += [model.generate(s, language_id="es"), torch.zeros(1, int(model.sr * PAUSE_S))]
    return torch.cat(parts[:-1], dim=1)


def main() -> None:
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    if not jobs:
        return

    model = load_model()
    from faster_whisper import WhisperModel

    asr = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")

    failed = 0
    for i, job in enumerate(jobs, 1):
        t0 = time.time()
        best = None
        for attempt in range(MAX_TRIES):
            wav = synth(model, job["text"], seed=attempt)
            path = out / f"{job['key']}.wav"
            ta.save(str(path), wav, model.sr)
            segs, _ = asr.transcribe(str(path), language="es", beam_size=1)
            hyp = " ".join(s.text for s in segs)
            wer = jiwer.wer(words(job["text"]), words(hyp))
            if best is None or wer < best[0]:
                best = (wer, wav, hyp)
            if wer <= MAX_WER:
                break
        wer, wav, hyp = best
        ta.save(str(out / f"{job['key']}.wav"), wav, model.sr)
        status = "ok" if wer <= MAX_WER else "REVISAR"
        if wer > MAX_WER:
            failed += 1
        print(
            f"[{i}/{len(jobs)}] {job['key']} {status} wer={wer:.0%} "
            f"{wav.shape[1] / model.sr:.1f}s en {time.time() - t0:.0f}s",
            flush=True,
        )
        if wer > MAX_WER:
            print(f"    texto:   {job['text']}\n    whisper: {hyp.strip()}", flush=True)
    if failed:
        print(f"{failed} clip(s) para revisar a oído: quizá falte una entrada en el léxico.", flush=True)


if __name__ == "__main__":
    main()
