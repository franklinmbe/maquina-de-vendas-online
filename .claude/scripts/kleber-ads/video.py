import os, json, shutil, subprocess, sys
D = os.path.join(os.environ['TEMP'], 'kleber-carrossel')
MUS_SRC = 'C:/Users/rjino/OneDrive/Desktop/Franklin/MAESTROS DA IA/MÁQUINA DE VENDAS ONLINE/app/hostnet-server/public/audio/musicas/musica-Instagram-Reels-Marketing-1.mp3'
music = os.path.join(D, 'musica.mp3'); shutil.copy(MUS_SRC, music)
d = json.load(open(os.path.join(D, 'durs.json')))
T = 0.35
L = [x + 0.5 for x in d]; L[-1] += 0.5
cards = [os.path.join(D, f) for f in ('v2card1.png', 'v2card3.png', 'v2card2.png', 'v2card4.png')]
starts = [0.0]
for i in range(1, 4): starts.append(sum(L[:i]) - i * T)
total = sum(L) - 3 * T
args = ['ffmpeg', '-y', '-v', 'error']
for i in range(4): args += ['-loop', '1', '-framerate', '30', '-t', f'{L[i]:.3f}', '-i', cards[i]]
for i in range(4): args += ['-i', os.path.join(D, f'voz{i+1}.wav')]
args += ['-i', music]
f = []
for i in range(4):
    f.append(f'[{i}:v]split[a{i}][b{i}];'
             f'[a{i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28,eq=brightness=-0.15:saturation=1.25[bg{i}];'
             f"[b{i}]scale=w='1080*(1+0.04*t/{L[i]:.3f})':h='1080*(1+0.04*t/{L[i]:.3f})':eval=frame,crop=1080:1080[fg{i}];"
             f'[bg{i}][fg{i}]overlay=x=0:y=(H-h)/2,fps=30,format=yuv420p[v{i}]')
trans = ['slideleft', 'circleopen', 'slideup']
prev = 'v0'
for k in range(1, 4):
    off = sum(L[:k]) - k * T
    f.append(f'[{prev}][v{k}]xfade=transition={trans[k-1]}:duration={T}:offset={off:.3f}[x{k}]'); prev = f'x{k}'
for i in range(4):
    ms = int((starts[i] + 0.25) * 1000)
    f.append(f'[{4+i}:a]adelay={ms}|{ms},volume=1.5[va{i}]')
f.append('[va0][va1][va2][va3]amix=inputs=4:normalize=0[voice];[voice]asplit[vs][vm]')
f.append(f'[8:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:d=0.8,afade=t=out:st={total-1.6:.3f}:d=1.6[m]')
f.append('[m][vs]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=400[md]')
f.append('[md][vm]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]')
out = os.path.join(D, 'video-caixa-dagua.mp4')
args += ['-filter_complex', ';'.join(f), '-map', f'[{prev}]', '-map', '[aout]', '-t', f'{total:.3f}',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]
r = subprocess.run(args, capture_output=True, text=True)
print('rc', r.returncode); print(r.stderr[-1500:])
print('total', round(total, 2), 'starts', [round(s, 2) for s in starts])
