"""Send ZaraRadio now-playing metadata to a configured HTTPS endpoint.

Run on the station PC. No audio or local file paths are uploaded.
Requires environment variables LLDB_NOW_PLAYING_URL and LLDB_NOW_PLAYING_TOKEN.
Example: python scripts/zararadio_sender.py "C:\\Users\\...\\Desktop\\ZaraRadioLogs"
"""
import datetime as dt
import json
import os
from pathlib import Path
import sys
import time
from urllib.request import Request, urlopen

from zararadio_now_playing import parse_log


def latest_song(folder):
    path = Path(folder) / (dt.date.today().isoformat() + ".log")
    if not path.is_file():
        return None
    return parse_log(path)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/zararadio_sender.py LOG_FOLDER")
    endpoint = os.environ.get("LLDB_NOW_PLAYING_URL", "")
    token = os.environ.get("LLDB_NOW_PLAYING_TOKEN", "")
    if not endpoint.startswith("https://") or not token:
        raise SystemExit("Set LLDB_NOW_PLAYING_URL (https) and LLDB_NOW_PLAYING_TOKEN first")
    previous = None
    while True:
        try:
            song = latest_song(sys.argv[1])
            if song and song != previous:
                payload = json.dumps({"title": song["title"], "artist": song["artist"],
                                      "time": song["time"], "date": song["date"]},
                                     ensure_ascii=False).encode("utf-8")
                request = Request(endpoint, data=payload,
                                  headers={"Content-Type": "application/json",
                                           "Authorization": "Bearer " + token},
                                  method="POST")
                with urlopen(request, timeout=12) as response:
                    if not 200 <= response.status < 300:
                        raise RuntimeError("HTTP " + str(response.status))
                previous = song
                print("Updated:", song["artist"], "-", song["title"], flush=True)
        except Exception as exc:
            print("Retry after error:", exc, flush=True)
        time.sleep(15)


if __name__ == "__main__":
    main()
