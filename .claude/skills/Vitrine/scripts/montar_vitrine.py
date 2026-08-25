#!/usr/bin/env python3
"""
Vitrine — montador de painel/relatorio client-facing.

Recebe um arquivo JSON com a especificacao dos dados (KPIs, graficos, destaques,
secoes) e gera um arquivo HTML unico, autossuficiente, com a marca do usuario,
pronto para enviar ao cliente ou imprimir em PDF.

Uso:
    python3 montar_vitrine.py <dados.json> [saida.html] [--config caminho/config.md]

Sem dependencias externas — so a biblioteca padrao do Python 3.
Os graficos usam Chart.js via CDN (precisa de internet so para visualizar).
"""

import sys
import os
import re
import json
import html
import base64
import datetime
from string import Template

# ---------------------------------------------------------------------------
# Config (marca do usuario) — lida de um config.md simples "chave: valor"
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "negocio": "Meu Negocio",
    "profissional": "",
    "cor": "#3B6CFF",
    "logo": "",
    "rodape": "",
}


def carregar_config(caminho):
    cfg = dict(DEFAULT_CONFIG)
    if not caminho or not os.path.isfile(caminho):
        return cfg
    with open(caminho, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or ":" not in linha:
                continue
            chave, _, valor = linha.partition(":")
            chave = chave.strip().lower()
            valor = valor.strip()
            if chave in ("negocio", "negócio", "empresa", "nome"):
                cfg["negocio"] = valor or cfg["negocio"]
            elif chave in ("profissional", "responsavel", "responsável", "consultor"):
                cfg["profissional"] = valor
            elif chave in ("cor", "cor_destaque", "accent"):
                if valor:
                    cfg["cor"] = valor
            elif chave in ("logo", "logotipo"):
                cfg["logo"] = valor
            elif chave in ("rodape", "rodapé", "contato"):
                cfg["rodape"] = valor
    return cfg


def auto_config():
    """Procura um .vitrine/config.md subindo a partir do diretorio atual."""
    d = os.getcwd()
    for _ in range(6):
        candidato = os.path.join(d, ".vitrine", "config.md")
        if os.path.isfile(candidato):
            return candidato
        pai = os.path.dirname(d)
        if pai == d:
            break
        d = pai
    return None


# ---------------------------------------------------------------------------
# Cor — clareia/escurece e monta paleta a partir de UMA cor de destaque
# ---------------------------------------------------------------------------

def hex_para_rgb(c):
    c = c.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    if len(c) != 6:
        return (59, 108, 255)
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return (59, 108, 255)


def rgb_para_hex(rgb):
    return "#{:02X}{:02X}{:02X}".format(*[max(0, min(255, int(v))) for v in rgb])


def mistura(rgb, alvo, t):
    return tuple(rgb[i] + (alvo[i] - rgb[i]) * t for i in range(3))


def paleta(cor):
    base = hex_para_rgb(cor)
    return {
        "accent": rgb_para_hex(base),
        "accent_hover": rgb_para_hex(mistura(base, (0, 0, 0), 0.15)),
        "accent_soft": rgb_para_hex(mistura(base, (255, 255, 255), 0.86)),
        "accent_rgb": "{}, {}, {}".format(*[int(v) for v in base]),
    }


# ---------------------------------------------------------------------------
# Logo opcional -> data URI inline (HTML continua autossuficiente)
# ---------------------------------------------------------------------------

def logo_data_uri(caminho):
    if not caminho or not os.path.isfile(caminho):
        return ""
    ext = os.path.splitext(caminho)[1].lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "svg": "image/svg+xml", "webp": "image/webp"}.get(ext, "image/png")
    try:
        with open(caminho, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return "data:{};base64,{}".format(mime, b64)
    except OSError:
        return ""


# ---------------------------------------------------------------------------
# Helpers de escape
# ---------------------------------------------------------------------------

def e(txt):
    return html.escape(str(txt if txt is not None else ""))


def tendencia_classe(t):
    t = (t or "").lower()
    if t in ("up", "sobe", "positiva", "pos", "+"):
        return "up", "&#9650;"   # triangulo cima
    if t in ("down", "desce", "negativa", "neg", "-"):
        return "down", "&#9660;"  # triangulo baixo
    return "flat", "&#8211;"


# ---------------------------------------------------------------------------
# Render dos blocos
# ---------------------------------------------------------------------------

def render_kpis(kpis):
    if not kpis:
        return ""
    cards = []
    for k in kpis:
        rotulo = e(k.get("rotulo", ""))
        valor = e(k.get("valor", ""))
        variacao = k.get("variacao", "")
        classe, seta = tendencia_classe(k.get("tendencia", ""))
        var_html = ""
        if variacao:
            var_html = '<div class="kpi-var {c}"><span class="seta">{s}</span>{v}</div>'.format(
                c=classe, s=seta, v=e(variacao))
        nota = e(k.get("nota", ""))
        nota_html = '<div class="kpi-nota">{}</div>'.format(nota) if nota else ""
        cards.append(
            '<div class="kpi">'
            '<div class="kpi-rotulo">{r}</div>'
            '<div class="kpi-valor">{v}</div>'
            '{var}{nota}'
            '</div>'.format(r=rotulo, v=valor, var=var_html, nota=nota_html)
        )
    return '<section class="kpis">{}</section>'.format("".join(cards))


def render_destaques(destaques):
    if not destaques:
        return ""
    itens = "".join("<li>{}</li>".format(e(d)) for d in destaques)
    return (
        '<section class="bloco destaques">'
        '<h2>Destaques</h2><ul class="lista-destaques">{}</ul>'
        '</section>'.format(itens)
    )


def render_secoes(secoes):
    if not secoes:
        return ""
    blocos = []
    for s in secoes:
        titulo = e(s.get("titulo", ""))
        texto = e(s.get("texto", "")).replace("\n", "<br>")
        h = "<h2>{}</h2>".format(titulo) if titulo else ""
        blocos.append('<section class="bloco texto">{}<p>{}</p></section>'.format(h, texto))
    return "".join(blocos)


CORES_SERIE_FALLBACK = ["#5B8DEF", "#22C7A9", "#F4A93C", "#E0607E", "#8E7BEF", "#3FB9C9"]


def render_graficos(graficos, pal):
    if not graficos:
        return "", ""
    cards = []
    scripts = []
    for i, g in enumerate(graficos):
        cid = "g{}".format(i)
        titulo = e(g.get("titulo", ""))
        tipo_in = (g.get("tipo", "barra") or "barra").lower()
        tipo = {"linha": "line", "barra": "bar", "barras": "bar", "coluna": "bar",
                "pizza": "doughnut", "rosca": "doughnut", "donut": "doughnut",
                "area": "line", "área": "line"}.get(tipo_in, "bar")
        is_area = tipo_in in ("area", "área")
        is_circular = tipo in ("doughnut",)
        labels = g.get("labels", [])
        series = g.get("series", [])
        if not series and "dados" in g:
            series = [{"nome": titulo or "Valor", "dados": g["dados"]}]

        datasets = []
        for j, s in enumerate(series):
            nome = s.get("nome", "Serie {}".format(j + 1))
            dados = s.get("dados", [])
            if is_circular:
                cores = [CORES_SERIE_FALLBACK[k % len(CORES_SERIE_FALLBACK)] for k in range(len(dados))]
                if j == 0:
                    cores[0] = pal["accent"]
                datasets.append({
                    "label": nome, "data": dados,
                    "backgroundColor": cores, "borderWidth": 0,
                })
            else:
                cor = pal["accent"] if j == 0 else CORES_SERIE_FALLBACK[(j) % len(CORES_SERIE_FALLBACK)]
                ds = {
                    "label": nome, "data": dados,
                    "borderColor": cor,
                    "backgroundColor": ("rgba({}, 0.14)".format(pal["accent_rgb"]) if (tipo == "line" and j == 0)
                                        else cor),
                    "borderWidth": 2.5 if tipo == "line" else 0,
                    "borderRadius": 6 if tipo == "bar" else 0,
                    "tension": 0.35,
                    "fill": bool(is_area and j == 0),
                    "pointRadius": 3 if tipo == "line" else 0,
                    "pointBackgroundColor": cor,
                }
                datasets.append(ds)

        config = {
            "type": tipo,
            "data": {"labels": labels, "datasets": datasets},
            "options": {
                "responsive": True,
                "maintainAspectRatio": False,
                "plugins": {
                    "legend": {
                        "display": (len(series) > 1 or is_circular),
                        "position": "bottom",
                        "labels": {"usePointStyle": True, "boxWidth": 8, "padding": 16,
                                   "font": {"family": "Inter, sans-serif", "size": 12}},
                    },
                },
                "scales": ({} if is_circular else {
                    "x": {"grid": {"display": False},
                          "ticks": {"font": {"family": "Inter, sans-serif", "size": 11}, "color": "#8A8F99"}},
                    "y": {"beginAtZero": True, "grid": {"color": "#EEF0F4", "drawBorder": False},
                          "ticks": {"font": {"family": "Inter, sans-serif", "size": 11}, "color": "#8A8F99"}},
                }),
                "cutout": ("62%" if is_circular else None),
            },
        }
        cards.append(
            '<section class="bloco grafico">'
            '{h}<div class="canvas-wrap"><canvas id="{cid}"></canvas></div>'
            '</section>'.format(h=("<h2>{}</h2>".format(titulo) if titulo else ""), cid=cid)
        )
        scripts.append(
            "new Chart(document.getElementById('{cid}'), {cfg});".format(
                cid=cid, cfg=json.dumps(config, ensure_ascii=False))
        )
    return "".join(cards), "\n".join(scripts)


# ---------------------------------------------------------------------------
# Documento
# ---------------------------------------------------------------------------

CSS = """
:root{
  --accent:$accent; --accent-hover:$accent_hover; --accent-soft:$accent_soft;
  --accent-rgb:$accent_rgb;
  --bg:#F6F7F9; --surface:#FFFFFF; --ink:#1A1D24; --ink-2:#5A6170; --ink-3:#9298A4;
  --border:#ECEEF2; --radius:18px; --shadow:0 1px 2px rgba(20,25,40,.04),0 12px 32px rgba(20,25,40,.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);
  color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;padding:40px 20px}
.pagina{max-width:960px;margin:0 auto}
.cabecalho{display:flex;align-items:center;justify-content:space-between;gap:24px;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:26px 30px;box-shadow:var(--shadow);margin-bottom:14px}
.marca{display:flex;align-items:center;gap:16px}
.marca img{height:46px;width:auto;border-radius:8px;object-fit:contain}
.marca .selo{height:46px;width:46px;border-radius:12px;background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;
  box-shadow:0 6px 16px rgba(var(--accent-rgb),.35)}
.marca .negocio{font-weight:650;font-size:17px;letter-spacing:-.2px}
.marca .sub{font-size:12.5px;color:var(--ink-3);margin-top:1px}
.cab-dir{text-align:right}
.cab-dir .periodo{display:inline-block;background:var(--accent-soft);color:var(--accent-hover);
  font-weight:600;font-size:12.5px;padding:5px 12px;border-radius:999px}
.cab-dir .data{font-size:12px;color:var(--ink-3);margin-top:7px}
.titulo-rel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:28px 30px;box-shadow:var(--shadow);margin-bottom:14px}
.titulo-rel .eyebrow{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.4px;
  color:var(--accent)}
.titulo-rel h1{font-size:27px;letter-spacing:-.6px;margin:6px 0 0}
.titulo-rel .cliente{color:var(--ink-2);font-size:15px;margin-top:4px}
.titulo-rel .resumo{margin-top:14px;color:var(--ink-2);font-size:15px;max-width:70ch}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:14px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px 22px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
.kpi-rotulo{font-size:12.5px;color:var(--ink-3);font-weight:550;text-transform:uppercase;letter-spacing:.4px}
.kpi-valor{font-size:30px;font-weight:730;letter-spacing:-1px;margin-top:8px}
.kpi-var{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:650;margin-top:8px;
  padding:3px 9px;border-radius:999px}
.kpi-var .seta{font-size:10px}
.kpi-var.up{color:#0E9F6E;background:#E7F8F1}
.kpi-var.down{color:#E0607E;background:#FCEBF0}
.kpi-var.flat{color:var(--ink-3);background:#F1F2F5}
.kpi-nota{font-size:12px;color:var(--ink-3);margin-top:8px}
.bloco{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:24px 28px;box-shadow:var(--shadow);margin-bottom:14px}
.bloco h2{font-size:17px;letter-spacing:-.3px;margin-bottom:14px}
.bloco.texto p{color:var(--ink-2);font-size:15px}
.lista-destaques{list-style:none;display:grid;gap:10px}
.lista-destaques li{position:relative;padding-left:26px;color:var(--ink-2);font-size:15px}
.lista-destaques li:before{content:"";position:absolute;left:0;top:8px;width:9px;height:9px;border-radius:50%;
  background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.canvas-wrap{position:relative;height:300px}
.rodape{text-align:center;color:var(--ink-3);font-size:12.5px;padding:18px 0 4px}
.rodape strong{color:var(--ink-2)}
@media(max-width:560px){body{padding:18px 12px}.cabecalho{flex-direction:column;align-items:flex-start}
  .cab-dir{text-align:left}.kpi-valor{font-size:26px}}
@media print{body{background:#fff;padding:0}.bloco,.kpi,.cabecalho,.titulo-rel{box-shadow:none;
  break-inside:avoid}.pagina{max-width:100%}}
"""

HTML_DOC = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;600;650;700;730&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>%(css)s</style>
</head>
<body>
<div class="pagina">
  <header class="cabecalho">
    <div class="marca">%(marca)s
      <div>
        <div class="negocio">%(negocio)s</div>
        %(prof)s
      </div>
    </div>
    <div class="cab-dir">
      %(periodo)s
      <div class="data">Gerado em %(data)s</div>
    </div>
  </header>

  <section class="titulo-rel">
    <div class="eyebrow">%(eyebrow)s</div>
    <h1>%(titulo)s</h1>
    %(cliente)s
    %(resumo)s
  </section>

  %(kpis)s
  %(graficos)s
  %(destaques)s
  %(secoes)s

  <div class="rodape">%(rodape)s</div>
</div>
<script>%(chart_scripts)s</script>
</body>
</html>
"""


def montar(dados, cfg):
    pal = paleta(cfg.get("cor", "#3B6CFF"))
    negocio = cfg.get("negocio", "Meu Negocio")

    uri = logo_data_uri(cfg.get("logo", ""))
    if uri:
        marca = '<img src="{}" alt="logo">'.format(uri)
    else:
        inicial = (negocio.strip()[:1] or "V").upper()
        marca = '<div class="selo">{}</div>'.format(e(inicial))

    prof = ('<div class="sub">{}</div>'.format(e(cfg["profissional"]))
            if cfg.get("profissional") else "")

    periodo = ('<span class="periodo">{}</span>'.format(e(dados["periodo"]))
               if dados.get("periodo") else "")

    cliente = ('<div class="cliente">Cliente: <strong>{}</strong></div>'.format(e(dados["cliente"]))
               if dados.get("cliente") else "")

    resumo = ('<p class="resumo">{}</p>'.format(e(dados["resumo"]).replace("\n", "<br>"))
              if dados.get("resumo") else "")

    graf_html, graf_js = render_graficos(dados.get("graficos", []), pal)

    rod_partes = []
    if cfg.get("profissional"):
        rod_partes.append("Preparado por <strong>{}</strong>".format(e(cfg["profissional"])))
    rod_partes.append(e(negocio))
    if cfg.get("rodape"):
        rod_partes.append(e(cfg["rodape"]))
    rodape = " &bull; ".join(rod_partes)

    css = Template(CSS).safe_substitute(pal)
    doc = HTML_DOC % {
        "title": e(dados.get("titulo", "Relatorio")) + " — " + e(negocio),
        "css": css,
        "marca": marca,
        "negocio": e(negocio),
        "prof": prof,
        "periodo": periodo,
        "data": datetime.date.today().strftime("%d/%m/%Y"),
        "eyebrow": e(dados.get("tipo_relatorio", "Relatorio de Resultados")),
        "titulo": e(dados.get("titulo", "Relatorio de Resultados")),
        "cliente": cliente,
        "resumo": resumo,
        "kpis": render_kpis(dados.get("kpis", [])),
        "graficos": graf_html,
        "destaques": render_destaques(dados.get("destaques", [])),
        "secoes": render_secoes(dados.get("secoes", [])),
        "rodape": rodape,
        "chart_scripts": graf_js,
    }
    return doc


def slug(txt):
    txt = re.sub(r"[^\w\s-]", "", (txt or "vitrine").lower())
    txt = re.sub(r"[\s_-]+", "-", txt).strip("-")
    return txt or "vitrine"


def main():
    args = [a for a in sys.argv[1:]]
    config_path = None
    if "--config" in args:
        i = args.index("--config")
        config_path = args[i + 1]
        del args[i:i + 2]

    if not args:
        print("Uso: python3 montar_vitrine.py <dados.json> [saida.html] [--config config.md]")
        sys.exit(1)

    dados_path = args[0]
    if not os.path.isfile(dados_path):
        print("Arquivo de dados nao encontrado: {}".format(dados_path))
        sys.exit(1)

    with open(dados_path, "r", encoding="utf-8") as f:
        dados = json.load(f)

    cfg = carregar_config(config_path or auto_config())

    doc = montar(dados, cfg)

    if len(args) >= 2:
        saida = args[1]
    else:
        nome = slug(dados.get("cliente") or dados.get("titulo") or "vitrine")
        saida = "vitrine-{}.html".format(nome)

    with open(saida, "w", encoding="utf-8") as f:
        f.write(doc)

    print("OK Vitrine gerada: {}".format(os.path.abspath(saida)))
    print("   Abra no navegador. Para PDF: Imprimir -> Salvar como PDF.")


if __name__ == "__main__":
    main()
