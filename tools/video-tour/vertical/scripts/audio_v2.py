"""Trilha original do tour vertical do Pontes (57,5 s) — sintetizada aqui, sem música de terceiros.
Mesma base do v1 (Dó maior, 100 BPM), com mais variação: progressão A (C–Am–F–G) e B (Am–F–C–G) alternando a
cada 4 compassos, arpejo que inverte a direção, baixo com contratempo na segunda metade. Efeitos afinados no tom
e marcados nos tempos da composição vertical (cenas, anéis, digitação, ✓, logo final)."""
import sys, wave
import numpy as np

SR = 44100
DUR = 57.5
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)
GROOVE = (3.4, 53.6)

def hz(nota):
    nomes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    return 440.0 * 2 ** ((nomes[nota[:-1]] + 12 * (int(nota[-1]) + 1) - 69) / 12)

def add(sig, ini, pan=0.0, ganho=1.0):
    i = int(ini * SR)
    if i >= N: return
    sig = sig[: N - i] * ganho
    L[i:i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4)
    R[i:i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4)

def env(n, a, d, s_lvl, r, dur):
    tt = np.arange(int(n)) / SR
    e = np.where(tt < a, tt / max(a, 1e-4), s_lvl + (1 - s_lvl) * np.exp(-(tt - a) / max(d, 1e-4)))
    return e * np.clip((dur - tt) / max(r, 1e-4), 0, 1)

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y

BEAT = 0.6; BAR = 2.4
C = (['C3', 'G3', 'B3', 'D4', 'E4'], 'C2'); Am = (['A2', 'E3', 'G3', 'B3', 'C4'], 'A1')
F = (['F2', 'C3', 'E3', 'G3', 'A3'], 'F1'); G = (['G2', 'D3', 'E3', 'G3', 'C4'], 'G1')
PROG_A = [C, Am, F, G]; PROG_B = [Am, F, C, G]
def acorde(b):
    if b * BAR >= 53.6: return C
    return (PROG_A if (b // 4) % 2 == 0 else PROG_B)[b % 4]

def pad(notas, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for k, nt in enumerate(notas):
        f = hz(nt)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            x += np.sin(2 * np.pi * ff * tt + k) + 0.28 * np.sin(4 * np.pi * ff * tt) + 0.1 * np.sin(6 * np.pi * ff * tt)
    return x / (len(notas) * 2.8) * env(n, 0.45, 1.2, 0.85, 0.5, dur)

compassos = int(np.ceil(DUR / BAR))
for b in range(compassos):
    ini = b * BAR
    final = ini >= 52.8
    notas, _ = acorde(b)
    dur = (DUR - ini) if final else BAR + 0.35
    add(pad(notas, dur), ini, pan=-0.15, ganho=0.30)
    add(pad([n[:-1] + str(int(n[-1]) + 1) for n in notas[1:4]], dur), ini, pan=0.2, ganho=0.10)
    if final: break

for b in range(compassos):  # baixo
    for bt in ((0, 2) if b * BAR < 28 else (0, 1.5, 2, 3.5)):
        ts = b * BAR + bt * BEAT
        if not (GROOVE[0] <= ts <= GROOVE[1] - 0.3): continue
        f = hz(acorde(b)[1]); n = int(0.5 * SR); tt = np.arange(n) / SR
        add((np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * env(n, 0.01, 0.22, 0.2, 0.1, 0.5), ts, ganho=0.28 if bt in (0, 2) else 0.18)

for i in range(int(DUR / (BEAT / 2))):  # arpejo
    ts = i * BEAT / 2
    if not (GROOVE[0] + 0.2 <= ts <= GROOVE[1] - 0.2): continue
    b = int(ts // BAR)
    notas = [n[:-1] + str(int(n[-1]) + 1) for n in acorde(b)[0][1:]]
    if (b // 8) % 2: notas = notas[::-1]
    f = hz(notas[i % len(notas)]); n = int(0.35 * SR); tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * h * tt) / h ** 1.6 for h in (1, 2, 3, 4)) * np.exp(-tt * 9)
    add(x, ts, pan=0.35 if i % 2 else -0.35, ganho=0.07)

for i in range(int(DUR / BEAT)):  # bumbo + chimbal
    ts = i * BEAT
    if GROOVE[0] + 0.2 <= ts <= GROOVE[1] - 0.3:
        n = int(0.22 * SR); tt = np.arange(n) / SR
        add(np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-tt * 28)) / SR) * np.exp(-tt * 14), ts, ganho=0.40)
    th = ts + BEAT / 2
    if GROOVE[0] + 0.5 <= th <= GROOVE[1] - 0.3:
        n = int(0.05 * SR); ruido = rng.standard_normal(n)
        add((ruido - lowpass(ruido, 6000)) * np.exp(-np.arange(n) / SR * 70), th, pan=0.25, ganho=0.033)

def whoosh(dur=0.55):
    n = int(dur * SR); tt = np.arange(n) / SR; ruido = rng.standard_normal(n)
    return (lowpass(ruido, 1800) - lowpass(ruido, 300)) * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2

def sino(nota, dur=1.1, brilho=1.0):
    f = hz(nota); n = int(dur * SR); tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * tt) + 0.45 * brilho * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3)
         + 0.2 * brilho * np.sin(2 * np.pi * f * 3.01 * tt) * np.exp(-tt * 5))
    return x * np.exp(-tt * 3.2) * np.clip(tt / 0.004, 0, 1)

def tique():
    n = int(0.03 * SR); tt = np.arange(n) / SR; ruido = rng.standard_normal(n)
    return (ruido - lowpass(ruido, 2500)) * np.exp(-tt * 180) + 0.3 * np.sin(2 * np.pi * hz('G6') * tt) * np.exp(-tt * 120)

for ts in (3.25, 7.45, 11.45, 14.85, 19.85, 23.85, 27.85, 31.85, 37.05, 42.05, 46.45, 50.45, 53.6):
    add(whoosh(), ts, ganho=0.09)
add(sino('E5', 1.6, 0.6), 0.8, pan=-0.1, ganho=0.10); add(sino('G5', 1.6, 0.6), 1.3, pan=0.1, ganho=0.07)
add(sino('C6', 0.9), 3.85, ganho=0.06)                                   # logo da revelação
add(tique(), 13.1, ganho=0.25); add(sino('G5', 0.7, 0.4), 13.15, ganho=0.06)  # olho: clique
for ts, nt in ((17.0, 'E6'), (21.0, 'G6'), (25.7, 'E6'), (43.8, 'G6')):  # anéis de destaque
    add(sino(nt, 1.0), ts, ganho=0.08)
add(sino('E6', 1.0), 33.4, pan=-0.2, ganho=0.09); add(sino('G6', 1.0), 33.8, pan=0.2, ganho=0.09)  # a acertar / a receber
for k, ts in enumerate((34.2, 34.35, 34.5)): add(sino(['C6', 'D6', 'E6'][k], 0.5, 0.3), ts, ganho=0.05)  # pílulas
add(sino('C6', 0.8, 0.5), 34.9, ganho=0.07)                              # cadeado
for k in range(6): add(tique(), 38.6 + k * 0.2, pan=0.3, ganho=0.22)     # digitação do banco
for k, nt in enumerate(['C6', 'E6', 'G6', 'C7']): add(sino(nt, 1.3), 40.2 + k * 0.07, pan=-0.2 + k * 0.13, ganho=0.075)  # ✓
for k in range(3): add(tique(), 51.5 + k * 0.22, pan=0.3, ganho=0.2)     # Ctrl K
add(sino('E6', 0.6, 0.4), 52.4, ganho=0.05)
for k, nt in enumerate(['G5', 'C6', 'E6', 'G6', 'C7']): add(sino(nt, 2.2, 0.7), 54.1 + k * 0.11, pan=-0.3 + k * 0.15, ganho=0.055)

mest = np.stack([L, R])
mest *= np.clip(t / 0.08, 0, 1)
mest *= np.clip((DUR - t) / 1.5, 0, 1) ** 0.8
mest = np.tanh(mest * 1.25) / np.tanh(1.25)
mest *= 0.89 / np.max(np.abs(mest))
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mest.T * 32767).astype(np.int16).tobytes())
print('ok', sys.argv[1], DUR)
