#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kokeilee, kuinka laajan alueen FMI:n Harmonie palauttaa ja kuinka suureksi data kasvaisi.
Hakee yhden tunnin tuulen (u) kullekin testialueelle. EI kirjoita pysyvää dataa.
Tulos kirjoitetaan tiedostoon bbox_result.txt (hotellin cron ohjaa stdoutin /dev/nulliin).

Aja:  cd .../windgrid && /usr/bin/python3 bbox_probe.py
"""
import os
import sys
import tempfile
import traceback
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402

AREAS = [
    ("nykyinen", (14.0, 54.0, 31.0, 66.0)),
    ("Skandinavia", (3.0, 54.0, 35.0, 72.0)),
    ("laaja", (0.0, 50.0, 40.0, 76.0)),
]


def missing_fraction(info):
    bm = info.get("bitmap")
    if bm is None:
        return 0.0
    total = info["ni"] * info["nj"]
    ones = 0
    for i in range(total):
        if (bm[i >> 3] >> (7 - (i & 7))) & 1:
            ones += 1
    return 1.0 - float(ones) / total


def main():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start, end = now, now + timedelta(hours=1)
    update.PARAMS = "WindUMS"
    for name, bbox in AREAS:
        print()
        print("--- %s bbox=%s" % (name, bbox))
        update.BBOX = bbox
        try:
            cands = update.latest_origin_urls(start, end)
            if not cands:
                print("  ei latauslinkkejä")
                continue
            origin, url = cands[0]
            tmp = os.path.join(tempfile.gettempdir(), "_bbox_probe.grib")
            update.http_download(update.with_range(url, start, end), tmp)
            size = os.path.getsize(tmp)
            for msg in update.read_messages(tmp):
                info = update.parse_message(msg)
                ni, nj = info["ni"], info["nj"]
                print("  ajo %s, GRIB %.1f MB, hila %dx%d, väli %.4f°" % (origin, size / 1e6, ni, nj, info["di"]))
                print("  la1=%.3f lo1=%.3f la2=%.3f lo2=%.3f" % (info["la1"], info["lo1"], info["la2"], info["lo2"]))
                print("  puuttuvia arvoja: %.1f %%" % (100 * missing_fraction(info)))
                for st in (4, 5, 6, 8):
                    nx, ny = len(range(0, ni, st)), len(range(0, nj, st))
                    est = nx * ny * 2 * 5.5 / 1e6   # u+v, ~5,5 tavua/arvo
                    print("  stride %d: %dx%d = %.2f MB/tunti, 48 h = %.0f MB" % (st, nx, ny, est, est * 48))
                break
            os.remove(tmp)
        except Exception:
            traceback.print_exc()


if __name__ == "__main__":
    import socket
    socket.setdefaulttimeout(120)
    out = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "bbox_result.txt"), "w")
    sys.stdout = out
    sys.stderr = out
    try:
        main()
    except Exception:
        traceback.print_exc()
    out.flush()
    out.close()
