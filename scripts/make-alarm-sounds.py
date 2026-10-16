#!/usr/bin/env python3
"""Render the alarm presets to WAV files for the Android notification channels.

The app synthesises the same tones live with the Web Audio API, so the sound a
user previews in settings is the sound the notification plays. Both read
src/lib/alarm-presets.json; run this after changing it.

    python3 scripts/make-alarm-sounds.py
"""
import json
import math
import os
import struct
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESETS = os.path.join(ROOT, "src", "lib", "alarm-presets.json")
OUT_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res", "raw")

RATE = 44100
FADE = 0.004  # short fade-in, else the attack clicks


def wave_sample(kind, phase):
    """phase in [0,1)."""
    if kind == "triangle":
        return 4.0 * abs(phase - 0.5) - 1.0
    return math.sin(2.0 * math.pi * phase)


def render(tones):
    length = max(t["at"] + t["dur"] for t in tones)
    total = int((length + 0.05) * RATE)
    buf = [0.0] * total

    for tone in tones:
        start = int(tone["at"] * RATE)
        count = int(tone["dur"] * RATE)
        freq, gain, kind = tone["freq"], tone["gain"], tone.get("type", "sine")
        for i in range(count):
            if start + i >= total:
                break
            t = i / RATE
            # Exponential decay to near-silence over the tone's length, matching
            # the Web Audio exponentialRampToValueAtTime in sounds.js.
            env = math.exp(-5.0 * t / tone["dur"])
            if t < FADE:
                env *= t / FADE
            buf[start + i] += gain * env * wave_sample(kind, (freq * t) % 1.0)

    peak = max((abs(v) for v in buf), default=1.0) or 1.0
    scale = 0.89 / peak if peak > 0.89 else 1.0
    return b"".join(struct.pack("<h", int(max(-1.0, min(1.0, v * scale)) * 32767)) for v in buf)


def main():
    with open(PRESETS) as fh:
        presets = json.load(fh)["presets"]

    os.makedirs(OUT_DIR, exist_ok=True)
    for preset in presets:
        pcm = render(preset["tones"])
        path = os.path.join(OUT_DIR, "alarm_%s.wav" % preset["id"])
        with wave.open(path, "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(pcm)
        print("%-28s %6.2f KB" % (os.path.relpath(path, ROOT), len(pcm) / 1024.0))

    # A channel's sound cannot be changed once created, and the plugin offers no
    # way to silence one, so "no sound" is its own channel playing silence.
    silent = os.path.join(OUT_DIR, "alarm_silent.wav")
    with wave.open(silent, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b"\x00\x00" * int(0.25 * RATE))
    print("%-28s %6.2f KB" % (os.path.relpath(silent, ROOT), os.path.getsize(silent) / 1024.0))


if __name__ == "__main__":
    main()
