"""Read the latest ZaraRadio 'start' event from a daily log.

Usage: py -3 scripts/zararadio_now_playing.py "C:\\Users\\...\\Documents\\ZaraRadioLogs"
Prints one JSON object. Does not transmit data or expose local paths.
"""
import datetime as dt
import json
import pathlib
import re
import sys

EVENT = re.compile(r"^(\d{2}:\d{2}:\d{2})\tstart\t(.+)$", re.I)
PREFIX = re.compile(r"^(.+?)\s+\d{1,3}\s+(.+)$")

def parse_log(path):
    raw = path.read_bytes()
    # ZaraRadio logs on Windows may use the local ANSI code page.
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("cp1252", errors="replace")
    latest = None
    for line in content.splitlines():
        match = EVENT.match(line.strip())
        if not match:
            continue
        clock, filename = match.groups()
        name = pathlib.PureWindowsPath(filename).stem
        parsed = PREFIX.match(name)
        artist = parsed.group(1).strip() if parsed else ""
        title = parsed.group(2).strip() if parsed else name
        latest = {"title": title, "artist": artist, "time": clock,
                  "date": path.stem, "source": "filename"}
    return latest

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: py -3 scripts/zararadio_now_playing.py LOG_FOLDER")
    folder = pathlib.Path(sys.argv[1])
    today = dt.date.today().isoformat()
    file = folder / (today + ".log")
    if not file.is_file():
        print(json.dumps({"status": "no_log", "date": today}))
        return
    result = parse_log(file)
    print(json.dumps(result or {"status": "no_song", "date": today}, ensure_ascii=False))

if __name__ == "__main__":
    main()
