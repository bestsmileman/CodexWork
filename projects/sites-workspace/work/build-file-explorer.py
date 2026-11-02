from pathlib import Path
base = Path(__file__).resolve().parent
shell = (base / 'explorer-shell.html').read_text(encoding='utf-8')
data = (base / 'explorer-data.json').read_text(encoding='utf-8')
(base.parent / 'outputs/Codex-files.html').write_text(shell.replace('const rows=DATA;', 'const rows='+data+';'), encoding='utf-8')
print('Created desktop-style Codex-files.html')
