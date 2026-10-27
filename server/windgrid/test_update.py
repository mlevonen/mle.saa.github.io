#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Itsetesti: rakentaa synteettisen GRIB2-tiedoston (yksinkertainen pakkaus,
lat/lon-hila) ja tarkistaa, että update.py purkaa sen oikein, molemmilla
skannaussuunnilla ja usealla bittimäärällä.

Aja:  python3 test_update.py
"""
import math
import os
import struct
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402


def sm32(v):
    """Etumerkki+suuruus -koodaus (GRIB2) 32 bit."""
    return (0x80000000 | (-v)) if v < 0 else v


def pack_bits(values, nbits):
    acc = 0
    total = 0
    for v in values:
        acc = (acc << nbits) | v
        total += nbits
    pad = (-total) % 8
    acc <<= pad
    return acc.to_bytes((total + pad) // 8, "big")


def build_message(field, ni, nj, la1, lo1, di, dj, scan, number, ref, fhour, nbits=16):
    """field[j][i] fysikaalisena arvona, j = skannausjärjestyksen rivi."""
    flat = [field[j][i] for j in range(nj) for i in range(ni)]
    D = 1
    ints = [round(v * 10 ** D) for v in flat]
    R = min(ints)
    X = [x - R for x in ints]
    sec1 = struct.pack(">IBHHBBBHBBBBBBB", 21, 1, 86, 0, 28, 0, 1,
                       ref.year, ref.month, ref.day, ref.hour, ref.minute, ref.second, 0, 1)
    la2 = la1 + (nj - 1) * dj * (1 if scan & 0x40 else -1)
    lo2 = lo1 + (ni - 1) * di
    sec3 = (struct.pack(">IBBIBBH", 72, 3, 0, ni * nj, 0, 0, 0)
            + struct.pack(">BBIBIBI", 6, 0, 0, 0, 0, 0, 0)
            + struct.pack(">II", ni, nj)
            + struct.pack(">II", 0, 0xFFFFFFFF)
            + struct.pack(">II", sm32(int(round(la1 * 1e6))), sm32(int(round(lo1 * 1e6))))
            + struct.pack(">B", 0x30)
            + struct.pack(">II", sm32(int(round(la2 * 1e6))), sm32(int(round(lo2 * 1e6))))
            + struct.pack(">II", int(round(di * 1e6)), int(round(dj * 1e6)))
            + struct.pack(">B", scan))
    assert len(sec3) == 72, len(sec3)
    sec4 = (struct.pack(">IBHH", 34, 4, 0, 0)
            + struct.pack(">BBBBBHBBI", 2, number, 2, 0, 0, 0, 0, 1, fhour)
            + struct.pack(">BBIBBI", 103, 0, 10, 255, 0, 0))
    assert len(sec4) == 34, len(sec4)
    sec5 = (struct.pack(">IBIH", 21, 5, ni * nj, 0)
            + struct.pack(">f", float(R))
            + struct.pack(">HHBB", 0, D, nbits, 0))
    assert len(sec5) == 21, len(sec5)
    sec6 = struct.pack(">IBB", 6, 6, 255)
    data = pack_bits(X, nbits)
    sec7 = struct.pack(">IB", 5 + len(data), 7) + data
    body = sec1 + sec3 + sec4 + sec5 + sec6 + sec7
    total = 16 + len(body) + 4
    return b"GRIB" + b"\x00\x00" + b"\x00" + b"\x02" + struct.pack(">Q", total) + body + b"7777"


def make_fields(ni, nj, north_first):
    """Luo u- ja v-kentät: u riippuu lon-indeksistä, v lat-indeksistä (maantieteellisesti)."""
    # jotta suunta on tarkistettavissa: arvot määräytyvät MAANTIETEELLISESTÄ sijainnista
    def u_at(lat_idx_from_south, i):
        return round(-5.0 + 0.5 * i, 1)

    def v_at(lat_idx_from_south, i):
        return round(-3.0 + 0.4 * lat_idx_from_south, 1)

    u = []
    v = []
    for j in range(nj):
        south_idx = (nj - 1 - j) if north_first else j
        u.append([u_at(south_idx, i) for i in range(ni)])
        v.append([v_at(south_idx, i) for i in range(ni)])
    return u, v, u_at, v_at


def run_case(north_first, nbits, ni=21, nj=13):
    ref = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
    di = dj = 0.0225
    lo1 = 14.0
    south_lat = 54.0
    if north_first:
        la1 = south_lat + (nj - 1) * dj
        scan = 0x00
    else:
        la1 = south_lat
        scan = 0x40
    u, v, u_at, v_at = make_fields(ni, nj, north_first)

    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "t.grib")
        with open(path, "wb") as f:
            for fh in (4, 5):  # 16:00 ja 17:00 UTC
                f.write(build_message(u, ni, nj, la1, lo1, di, dj, scan, 2, ref, fh, nbits))
                f.write(build_message(v, ni, nj, la1, lo1, di, dj, scan, 3, ref, fh, nbits))
        fields = {}
        n = update.decode_file(path, 4, fields)
        assert n == 4, n
        assert sorted(fields) == ["2026-10-27T16:00:00Z", "2026-10-27T17:00:00Z"], sorted(fields)
        slot = fields["2026-10-27T16:00:00Z"]
        (urows, meta), (vrows, _) = slot["u"], slot["v"]

    exp_nx = len(range(0, ni, 4))
    exp_ny = len(range(0, nj, 4))
    assert meta["nx"] == exp_nx and meta["ny"] == exp_ny, meta
    assert abs(meta["lo1"] - 14.0) < 1e-6
    north_lat = south_lat + (nj - 1) * dj
    assert abs(meta["la1"] - north_lat) < 1e-6, (meta["la1"], north_lat)
    assert abs(meta["dx"] - 0.09) < 1e-9 and abs(meta["dy"] - 0.09) < 1e-9

    # Tarkista jokainen arvo maantieteellisesti: rivi r = pohjoisesta alkaen
    for r in range(exp_ny):
        south_idx = (nj - 1) - r * 4   # pohjoisesta r:s harvennettu rivi
        for c in range(exp_nx):
            i = c * 4
            assert abs(urows[r][c] - u_at(south_idx, i)) < 1e-6, ("u", r, c, urows[r][c], u_at(south_idx, i))
            assert abs(vrows[r][c] - v_at(south_idx, i)) < 1e-6, ("v", r, c, vrows[r][c], v_at(south_idx, i))

    # JSON-rakenne
    out = update.velocity_json(slot, "2026-10-27T16:00:00Z")
    assert len(out) == 2
    assert out[0]["header"]["parameterNumber"] == 2 and out[1]["header"]["parameterNumber"] == 3
    assert len(out[0]["data"]) == exp_nx * exp_ny
    h = out[0]["header"]
    assert h["la1"] > h["la2"] and h["lo1"] < h["lo2"]


def main():
    cases = [(nf, nb) for nf in (True, False) for nb in (8, 12, 16, 24)]
    for nf, nb in cases:
        run_case(nf, nb)
        print("OK  pohjoinen_ensin=%-5s bits=%d" % (nf, nb))
    # nopeusarvio realistisella alueella
    assert update.read_value(pack_bits([5, 1000, 4095], 12), 1, 12) == 1000
    print("Kaikki testit läpäisty.")


if __name__ == "__main__":
    main()
