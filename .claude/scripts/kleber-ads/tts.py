import os, sys, json, base64, urllib.request, wave
key = os.environ.get('GEMINI_API_KEY')
out = os.path.join(os.environ['TEMP'], 'kleber-carrossel')
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'Kore'
STYLE = 'Diga de forma animada, alegre e persuasiva, como uma locutora de anúncio de rádio, com bom ritmo: '
parts = [
    "Precisando de caixa d'água? Na Kleber Materiais de Construção, em Madureira, tem caixa d'água de dois mil litros pra sua casa!",
    'E tem mais: tijolo, areia, brita e tudo pra sua obra.',
    'É só chamar no WhatsApp e pedir o preço de hoje!',
    'Não fique sem água. Chama agora!',
]
durs = []
for i, text in enumerate(parts, 1):
    body = {'contents': [{'parts': [{'text': STYLE + text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}}
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=' + key,
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=180))
        pcm = base64.b64decode(data['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except Exception as e:
        print('parte', i, 'ERRO', str(e)[:300]); sys.exit(1)
    path = os.path.join(out, f'voz{i}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    durs.append(len(pcm) / 2 / 24000); print('parte', i, 'ok', round(durs[-1], 2), 's')
json.dump(durs, open(os.path.join(out, 'durs.json'), 'w'))
print('total', round(sum(durs), 2))
