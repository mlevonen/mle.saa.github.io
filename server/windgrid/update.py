#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Merisää – tuulikartan datan päivitysskripti (KOKEELLINEN)

Hakee FMI:n Harmonie-mallin 10 m tuulen (u, v) GRIB2-muodossa, purkaa sen,
harventaa hilan ja kirjoittaa tuntikohtaiset JSON-tiedostot leaflet-velocity-
kirjaston ymmärtämässä muodossa. Selain lukee tiedostot staattisina.

Ajetaan croniin (esim. kerran tunnissa):
    /usr/bin/python3 /home/KAYTTAJA/public_html/windgrid/update.py

Vaatii vain Pythonin vakiokirjaston (testattu 3.6-yhteensopivaksi, ei numpya).

Valitsimet:
    --force    hae ja kirjoita uudelleen, vaikka uusin ajo on jo käsitelty
    --debug    tulosta lisätietoja (GRIB-otsikot, arvoalueet)
    --out DIR  kirjoita data tähän kansioon (oletus: ./data skriptin vieressä)
"""

import json
import os
import re
import struct
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------- asetukset
BBOX = (14.0, 54.0, 31.0, 66.0)   # lon_min, lat_min, lon_max, lat_max
HOURS = 48                        # montako tuntia eteenpäin
STRIDE = 4                        # hilan harvennus (natiivi ~0,0225° -> ~0,09°)
CHUNK_HOURS = 12                  # ladataan jaksoissa (säästää muistia/levyä)
PARAMS = "WindUMS,WindVMS"
USER_AGENT = "Mozilla/5.0 (compatible; MerisaaWindgrid/1.0; +https://merisaa.fi)"
LOCK_MAX_AGE_S = 15 * 60
WFS = ("https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetFeature"
       "&storedquery_id=fmi::forecast::harmonie::surface::grid"
       "&starttime={start}&endtime={end}&bbox={bbox}&parameters={params}&format=grib2")

DEBUG = False


def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def dlog(*a):
    if DEBUG:
        log("[debug]", *a)


# ------------------------------------------------------------------ HTTP
def http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def http_download(url, dest, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------- GRIB2
def _s32(v):
    """GRIB2:n etumerkki+suuruus -koodaus (32 bit)."""
    return -(v & 0x7FFFFFFF) if v & 0x80000000 else v


def _s16(v):
    return -(v & 0x7FFF) if v & 0x8000 else v


def read_messages(path):
    """Käy GRIB2-tiedoston viestit läpi yksi kerrallaan (bytes)."""
    with open(path, "rb") as f:
        while True:
            head = f.read(16)
            if len(head) < 16:
                return
            if head[:4] != b"GRIB":
                # yritä löytää seuraava GRIB-tunniste (täytetavut yms.)
                rest = head + f.read(1 << 16)
                idx = rest.find(b"GRIB", 1)
                if idx < 0:
                    return
                f.seek(-(len(rest) - idx), 1)
                continue
            edition = head[7]
            if edition != 2:
                raise ValueError("Vain GRIB2 tuettu (edition=%d)" % edition)
            total = struct.unpack(">Q", head[8:16])[0]
            body = f.read(total - 16)
            yield head + body


def parse_message(msg):
    """Palauttaa sanakirjan: kenttien metatiedot + funktio arvojen lukuun."""
    if msg[:4] != b"GRIB" or msg[-4:] != b"7777":
        raise ValueError("Viallinen GRIB-viesti")

    info = {}
    pos = 16
    end = len(msg) - 4
    sec7 = None
    bitmap_ind = 255
    while pos < end:
        slen = struct.unpack(">I", msg[pos:pos + 4])[0]
        snum = msg[pos + 4]
        s = msg[pos:pos + slen]
        if snum == 1:
            y, mo, d, h, mi, se = struct.unpack(">HBBBBB", s[12:19])
            info["ref_time"] = datetime(y, mo, d, h, mi, se, tzinfo=timezone.utc)
        elif snum == 3:
            info["grid_template"] = struct.unpack(">H", s[12:14])[0]
            info["ni"], info["nj"] = struct.unpack(">II", s[30:38])
            la1, lo1 = struct.unpack(">II", s[46:54])
            la2, lo2 = struct.unpack(">II", s[55:63])
            di, dj = struct.unpack(">II", s[63:71])
            info["la1"], info["lo1"] = _s32(la1) / 1e6, _s32(lo1) / 1e6
            info["la2"], info["lo2"] = _s32(la2) / 1e6, _s32(lo2) / 1e6
            info["di"], info["dj"] = di / 1e6, dj / 1e6
            info["scan"] = s[71]
        elif snum == 4:
            info["category"] = s[9]
            info["number"] = s[10]
            info["time_unit"] = s[17]
            info["forecast_time"] = struct.unpack(">I", s[18:22])[0]
        elif snum == 5:
            info["npoints"] = struct.unpack(">I", s[5:9])[0]
            info["packing_template"] = struct.unpack(">H", s[9:11])[0]
            info["ref_value"] = struct.unpack(">f", s[11:15])[0]
            info["bin_scale"] = _s16(struct.unpack(">H", s[15:17])[0])
            info["dec_scale"] = _s16(struct.unpack(">H", s[17:19])[0])
            info["nbits"] = s[19]
        elif snum == 6:
            bitmap_ind = s[5]
            if bitmap_ind == 0:
                info["bitmap"] = s[6:]
        elif snum == 7:
            sec7 = s[5:]
        if slen < 5:
            raise ValueError("Virheellinen osan pituus")
        pos += slen

    if info.get("grid_template") != 0:
        raise ValueError("Tuettu vain lat/lon-hila (template 3.0), nyt %r" % info.get("grid_template"))
    if info.get("packing_template") != 0:
        raise ValueError("Tuettu vain yksinkertainen pakkaus (template 5.0), nyt %r" % info.get("packing_template"))
    if bitmap_ind not in (0, 255):
        raise ValueError("Bittikartta-tyyppi %r ei tuettu (vain 0 ja 255)" % bitmap_ind)
    if bitmap_ind == 0:
        total = info["ni"] * info["nj"]
        bm = info.get("bitmap", b"")
        if len(bm) * 8 < total:
            raise ValueError("Bittikartta liian lyhyt")
        missing = _count_missing(bm, total)
        info["missing"] = missing
        # Jos kaikki pisteet ovat mukana, bittikartasta ei ole haittaa -> käsitellään kuin ei olisi
        info["bitmap"] = bm if missing else None
    else:
        info["bitmap"] = None
        info["missing"] = 0
    if info["scan"] & 0xA0:
        raise ValueError("Skannaustapa ei tuettu (scan=0x%02x)" % info["scan"])
    if sec7 is None:
        raise ValueError("Data-osa puuttuu")
    info["data"] = sec7
    return info


def unit_to_timedelta(unit, value):
    if unit == 0:
        return timedelta(minutes=value)
    if unit == 1:
        return timedelta(hours=value)
    if unit == 2:
        return timedelta(days=value)
    raise ValueError("Aikayksikkö %r ei tuettu" % unit)


_POP = [bin(i).count("1") for i in range(256)]


def _count_missing(bitmap, total):
    """Montako pistettä (0-bittiä) puuttuu ensimmäisen total:n joukosta."""
    full_bytes = total >> 3
    ones = sum(_POP[b] for b in bitmap[:full_bytes])
    rem = total & 7
    if rem:
        ones += _POP[bitmap[full_bytes] >> (8 - rem)]
    return total - ones


def _build_rank(bitmap):
    """cum[i] = montako 1-bittiä on tavuissa 0..i-1 (data-indeksin laskemiseen)."""
    cum = [0] * (len(bitmap) + 1)
    run = 0
    for i, b in enumerate(bitmap):
        cum[i] = run
        run += _POP[b]
    cum[len(bitmap)] = run
    return cum


def read_value(data, k, nbits):
    """Lukee k:nnen kokonaisluvun bittivirrasta (nbits bittiä / arvo)."""
    bit = k * nbits
    start = bit >> 3
    shift = bit & 7
    nbytes = (shift + nbits + 7) >> 3
    chunk = int.from_bytes(data[start:start + nbytes], "big")
    return (chunk >> (nbytes * 8 - shift - nbits)) & ((1 << nbits) - 1)


def sample_field(info, stride):
    """
    Palauttaa (rivit_pohjoisesta_etelään, meta), jossa rivit on lista listoja
    (m/s) ja meta sisältää harvennetun hilan geometrian.
    """
    ni, nj = info["ni"], info["nj"]
    nbits = info["nbits"]
    r = info["ref_value"]
    e = info["bin_scale"]
    d = info["dec_scale"]
    data = info["data"]
    scale = (2.0 ** e) / (10.0 ** d)
    offs = r / (10.0 ** d)

    south_to_north = bool(info["scan"] & 0x40)

    cols = list(range(0, ni, stride))
    rows_scan = []
    if south_to_north:
        # ensimmäinen rivi = eteläisin; pohjoisin on viimeinen
        n = len(range(0, nj, stride))
        rows_scan = [(nj - 1) - i * stride for i in range(n)]
        north_lat = info["la1"] + (nj - 1) * info["dj"]
    else:
        rows_scan = list(range(0, nj, stride))
        north_lat = info["la1"]

    bitmap = info.get("bitmap")
    cum = _build_rank(bitmap) if bitmap else None
    missing_seen = 0

    rows = []
    for rs in rows_scan:
        base = rs * ni
        row = []
        for c in cols:
            idx = base + c
            if bitmap is not None:
                byte = bitmap[idx >> 3]
                bit = (byte >> (7 - (idx & 7))) & 1
                if not bit:
                    row.append(0.0)  # puuttuva arvo -> tyyni
                    missing_seen += 1
                    continue
                # datan indeksi = montako olemassa olevaa pistettä ennen tätä
                before = cum[idx >> 3] + _POP[byte >> (8 - (idx & 7))] if (idx & 7) else cum[idx >> 3]
                k = before
            else:
                k = idx
            if nbits == 0:
                row.append(round(offs, 1))
            else:
                row.append(round(offs + read_value(data, k, nbits) * scale, 1))
        rows.append(row)
    if missing_seen:
        dlog("puuttuvia arvoja harvennetussa hilassa:", missing_seen)

    meta = {
        "nx": len(cols),
        "ny": len(rows_scan),
        "lo1": info["lo1"],
        "la1": north_lat,
        "dx": info["di"] * stride,
        "dy": info["dj"] * stride,
    }
    meta["lo2"] = meta["lo1"] + (meta["nx"] - 1) * meta["dx"]
    meta["la2"] = meta["la1"] - (meta["ny"] - 1) * meta["dy"]
    return rows, meta


def decode_file(path, stride, fields):
    """
    Lukee tiedoston ja lisää sanakirjaan fields[valid_time_iso] = {"u":(rows,meta), "v":..., "ref":dt}.
    """
    count = 0
    for msg in read_messages(path):
        info = parse_message(msg)
        if info["category"] != 2 or info["number"] not in (2, 3):
            dlog("ohitetaan kenttä", info["category"], info["number"])
            continue
        valid = info["ref_time"] + unit_to_timedelta(info["time_unit"], info["forecast_time"])
        rows, meta = sample_field(info, stride)
        key = iso(valid)
        slot = fields.setdefault(key, {"ref": info["ref_time"]})
        slot["u" if info["number"] == 2 else "v"] = (rows, meta)
        count += 1
        if DEBUG:
            flat = [x for r in rows for x in r]
            dlog("viesti", key, "param", info["number"], "hila", info["ni"], "x", info["nj"],
                 "-> ", meta["nx"], "x", meta["ny"], "min/max", min(flat), max(flat),
                 "pakkaus", info["packing_template"], "bits", info["nbits"], "scan", hex(info["scan"]))
    return count


# ---------------------------------------------------------- JSON-ulostulo
def velocity_json(slot, valid_iso):
    ref = iso(slot["ref"])
    out = []
    for comp, num in (("u", 2), ("v", 3)):
        rows, meta = slot[comp]
        header = {
            "parameterUnit": "m.s-1",
            "parameterCategory": 2,
            "parameterNumber": num,
            "parameterNumberName": "eastward_wind" if comp == "u" else "northward_wind",
            "nx": meta["nx"], "ny": meta["ny"],
            "lo1": round(meta["lo1"], 4), "la1": round(meta["la1"], 4),
            "lo2": round(meta["lo2"], 4), "la2": round(meta["la2"], 4),
            "dx": round(meta["dx"], 5), "dy": round(meta["dy"], 5),
            "refTime": ref, "forecastTime": 0,
        }
        out.append({"header": header, "data": [v for r in rows for v in r]})
    return out


def atomic_write(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


# -------------------------------------------------------------- päälogiikka
def latest_origin_urls(start_dt, end_dt):
    """Palauttaa download-URLit uusimmasta vanhimpaan ajoon."""
    url = WFS.format(start=iso(start_dt), end=iso(end_dt),
                     bbox=",".join(str(x) for x in BBOX), params=PARAMS)
    xml = http_get(url, 60).decode("utf-8", "replace")
    urls = re.findall(r"https://opendata\.fmi\.fi/download[^\"<\s]+", xml)
    urls = [u.replace("&amp;", "&") for u in urls]
    urls = list(dict.fromkeys(urls))

    def origin(u):
        m = re.search(r"origintime=([^&]+)", u)
        return m.group(1) if m else ""

    urls.sort(key=origin, reverse=True)
    return [(origin(u), u) for u in urls]


def with_range(url, start_dt, end_dt):
    url = re.sub(r"starttime=[^&]+", "starttime=" + iso(start_dt), url)
    url = re.sub(r"endtime=[^&]+", "endtime=" + iso(end_dt), url)
    return url


def acquire_lock(lock_path):
    if os.path.exists(lock_path):
        age = time.time() - os.path.getmtime(lock_path)
        if age < LOCK_MAX_AGE_S:
            return False
    with open(lock_path, "w") as f:
        f.write(str(os.getpid()))
    return True


def main(argv):
    global DEBUG
    force = "--force" in argv
    DEBUG = "--debug" in argv
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "data")
    if "--out" in argv:
        out_dir = argv[argv.index("--out") + 1]
    log("Käynnistyy (Python %s, kansio %s)" % (sys.version.split()[0], out_dir))
    os.makedirs(out_dir, exist_ok=True)

    lock = os.path.join(out_dir, ".lock")
    if not acquire_lock(lock):
        log("Toinen ajo käynnissä (lukko), lopetetaan.")
        return 0

    try:
        manifest_path = os.path.join(out_dir, "manifest.json")
        old = None
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path, encoding="utf-8") as f:
                    old = json.load(f)
            except Exception:
                old = None

        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start = now
        end = now + timedelta(hours=HOURS)

        log("Haetaan FMI:n latauslinkit…")
        candidates = latest_origin_urls(start, end)
        if not candidates:
            log("VIRHE: FMI ei palauttanut latauslinkkejä.")
            return 1

        errors = []
        for origin, base_url in candidates:
            if old and old.get("origin") == origin and not force:
                # sama ajo kuin jo käsitelty -> vain "tarkistettu"-aikaleima
                old["checked"] = iso(datetime.now(timezone.utc))
                atomic_write(manifest_path, json.dumps(old, ensure_ascii=False))
                log("Uusin ajo (%s) on jo käsitelty." % origin)
                return 0
            try:
                fields = {}
                t = start
                chunk_no = 0
                while t < end:
                    t2 = min(t + timedelta(hours=CHUNK_HOURS - 1), end)
                    tmp = os.path.join(out_dir, "_chunk%d.grib" % chunk_no)
                    log("Ladataan", origin, iso(t), "-", iso(t2))
                    http_download(with_range(base_url, t, t2), tmp)
                    n = decode_file(tmp, STRIDE, fields)
                    os.remove(tmp)
                    log("  purettu kenttiä:", n)
                    t = t2 + timedelta(hours=1)
                    chunk_no += 1
                complete = sorted(k for k, v in fields.items() if "u" in v and "v" in v)
                if not complete:
                    raise ValueError("Yhtään täydellistä u+v-tuntia ei saatu")
                break
            except Exception as ex:
                errors.append("%s: %s" % (origin, ex))
                log("Ajo", origin, "epäonnistui:", ex)
                for leftover in os.listdir(out_dir):
                    if leftover.startswith("_chunk"):
                        os.remove(os.path.join(out_dir, leftover))
                fields = None
        else:
            log("VIRHE: kaikki ajot epäonnistuivat:", errors)
            return 1

        hours = []
        for key in complete:
            fname = "wind_%s.json" % key.replace("-", "").replace(":", "")[:11]  # wind_20261027T16.json
            payload = velocity_json(fields[key], key)
            atomic_write(os.path.join(out_dir, fname),
                         json.dumps(payload, separators=(",", ":")))
            hours.append({"time": key, "file": fname})

        meta = fields[complete[0]]["u"][1]
        manifest = {
            "origin": iso(fields[complete[0]]["ref"]),
            "updated": iso(datetime.now(timezone.utc)),
            "checked": iso(datetime.now(timezone.utc)),
            "source": "Ilmatieteen laitos, Harmonie (CC BY 4.0)",
            "grid": {"nx": meta["nx"], "ny": meta["ny"], "lo1": meta["lo1"],
                     "la1": meta["la1"], "lo2": meta["lo2"], "la2": meta["la2"]},
            "hours": hours,
        }
        # manifest viimeisenä: selain näkee uuden listan vasta kun tiedostot ovat valmiit
        atomic_write(manifest_path, json.dumps(manifest, ensure_ascii=False))

        keep = {h["file"] for h in hours} | {"manifest.json", ".lock"}
        for name in os.listdir(out_dir):
            if name.startswith("wind_") and name not in keep:
                os.remove(os.path.join(out_dir, name))

        log("Valmis: %d tuntia, ajo %s" % (len(hours), manifest["origin"]))
        return 0
    finally:
        try:
            os.remove(lock)
        except OSError:
            pass


if __name__ == "__main__":
    import socket
    import traceback
    socket.setdefaulttimeout(90)
    try:
        sys.exit(main(sys.argv[1:]))
    except SystemExit:
        raise
    except BaseException:
        log("KAATUI:")
        traceback.print_exc()
        sys.stdout.flush()
        sys.exit(1)
