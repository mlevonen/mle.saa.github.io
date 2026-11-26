#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diagnostiikka: selvittää mitä FMI:n Harmonie-malli palauttaa parametrilla "Pressure"
(merenpinnan tasolle redusoitu paine PRMSL vai aseman pintapaine PRES) sekä mitä
geopotentiaali/orografia-kenttiä on saatavilla. EI kirjoita mitään pysyvää dataa.

Aja palvelimella (samassa kansiossa kuin update.py):
    /usr/bin/python3 pressure_probe.py

Tulosta tulos (kaikki rivit) takaisin keskusteluun.
"""
import os
import re
import struct
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402

PARAMS_TO_TRY = ["Pressure", "GeopHeight", "Temperature"]


def level_info(msg):
    """Lukee osasta 4: tuotemalli, kategoria, numero, ensimmäisen kiinteän pinnan tyyppi ja arvo."""
    pos = 16
    end = len(msg) - 4
    while pos < end:
        slen = struct.unpack(">I", msg[pos:pos + 4])[0]
        snum = msg[pos + 4]
        if snum == 4:
            s = msg[pos:pos + slen]
            tmpl = struct.unpack(">H", s[7:9])[0]
            cat, num = s[9], s[10]
            # Tuotemalli 4.0 / 4.8 jne: ensimmäinen kiinteä pinta alkaa oktetista 23 (indeksi 22)
            ltype = s[22]
            sf = s[23]
            sv = struct.unpack(">I", s[24:28])[0]
            return tmpl, cat, num, ltype, sf, sv
        pos += slen
    return None


def main():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start, end = now, now + timedelta(hours=1)
    update.DEBUG = False
    print("=== Harmonie-parametrien tarkistus", update.iso(now), "===")

    for param in PARAMS_TO_TRY:
        print()
        print("--- parametri:", param)
        update.PARAMS = param
        try:
            cands = update.latest_origin_urls(start, end)
        except Exception as ex:
            print("  WFS-haku epäonnistui:", ex)
            continue
        if not cands:
            print("  ei latauslinkkejä (parametria ei tuettu?)")
            continue
        origin, url = cands[0]
        print("  ajo:", origin)
        tmp = os.path.join(tempfile.gettempdir(), "_probe_%s.grib" % param)
        try:
            update.http_download(update.with_range(url, start, end), tmp)
        except Exception as ex:
            print("  lataus epäonnistui:", ex)
            continue
        n = 0
        for msg in update.read_messages(tmp):
            n += 1
            li = level_info(msg)
            try:
                info = update.parse_message(msg)
                rows, meta = update.sample_field(info, 8)
                flat = [x for r in rows for x in r]
                vals = "min=%.1f max=%.1f keskiarvo=%.1f (yksikkö: GRIB-arvo sellaisenaan)" % (
                    min(flat), max(flat), sum(flat) / len(flat))
                grid = "hila %dx%d, pakkaus %s" % (info["ni"], info["nj"], info["packing_template"])
            except Exception as ex:
                vals = "arvojen purku epäonnistui: %s" % ex
                grid = ""
            if li:
                tmpl, cat, num, ltype, sf, sv = li
                print("  viesti %d: tuotemalli=4.%d kategoria=%d numero=%d  pinnan_tyyppi=%d (scale=%d arvo=%d)  %s  %s"
                      % (n, tmpl, cat, num, ltype, sf, sv, grid, vals))
            else:
                print("  viesti %d: osa 4 puuttuu" % n)
            if n >= 2:
                break
        try:
            os.remove(tmp)
        except OSError:
            pass

    print()
    print("Tulkinta: kategoria 3, numero 1 = PRMSL (merenpinnan paine); numero 0 = PRES (pintapaine).")
    print("Pinnan tyyppi 101 = keskimääräinen merenpinta, 1 = maan/veden pinta, 103 = korkeus maanpinnasta.")


if __name__ == "__main__":
    import socket
    import traceback
    socket.setdefaulttimeout(90)
    # Kirjoitetaan tuloste itse tiedostoon, koska hotellin cron ohjaa stdoutin /dev/nulliin.
    out = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "probe_result.txt"), "w")
    sys.stdout = out
    sys.stderr = out
    try:
        main()
    except Exception:
        traceback.print_exc()
    out.flush()
    out.close()
