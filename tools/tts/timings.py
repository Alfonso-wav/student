"""Tiempos de cada palabra de la narración, para los subtítulos.

Lo llama `scripts/tts.ts`:

    uv run timings.py trabajos.json carpeta-audio

`trabajos.json`: lista de {"key": str, "words": [str]}. `words` son las palabras tal como se
muestran (guion sin markdown, sin léxico de pronunciación). Por cada trabajo transcribe
`<carpeta-audio>/<key>.m4a` con Whisper (marcas por palabra) y escribe `<key>.json`:

    {"words": [...], "t": [[inicio, fin], ...]}   # segundos, una entrada por palabra

Whisper escribe a su manera ("200.000" por "doscientas mil", "SQL" por "ese cu ele"): se alinean
las palabras que coinciden y los huecos se reparten en proporción a su longitud.
"""

import difflib
import json
import re
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def norm(w: str) -> str:
    return re.sub(r"[^\wáéíóúñü]", "", w.lower())


def align(words: list[str], heard: list[tuple[str, float, float]], duration: float) -> list[list[float]]:
    a = [norm(w) for w in words]
    b = [norm(w) for w, _, _ in heard]
    times: list[list[float] | None] = [None] * len(words)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            _, s, e = heard[blk.b + k]
            times[blk.a + k] = [s, e]

    # Huecos sin emparejar: se reparten entre el final de la anterior y el inicio de la siguiente.
    i = 0
    while i < len(words):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(words) and times[j] is None:
            j += 1
        start = times[i - 1][1] if i > 0 else (heard[0][1] if heard else 0.0)
        end = times[j][0] if j < len(words) else (heard[-1][2] if heard else duration)
        if end <= start:
            end = start + 0.25 * (j - i)
        weights = [max(1, len(words[k])) for k in range(i, j)]
        total = sum(weights)
        t = start
        for k, wgt in zip(range(i, j), weights):
            d = (end - start) * wgt / total
            times[k] = [t, t + d]
            t += d
        i = j
    return [[round(s, 3), round(e, 3)] for s, e in times]  # type: ignore[misc]


def main() -> None:
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    folder = Path(sys.argv[2])
    if not jobs:
        return
    model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    for n, job in enumerate(jobs, 1):
        audio = folder / f"{job['key']}.m4a"
        segs, info = model.transcribe(str(audio), language="es", beam_size=1, word_timestamps=True)
        heard = [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or [])]
        t = align(job["words"], heard, info.duration)
        (folder / f"{job['key']}.json").write_text(
            json.dumps({"words": job["words"], "t": t}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"[{n}/{len(jobs)}] tiempos {job['key']}", flush=True)


if __name__ == "__main__":
    main()
