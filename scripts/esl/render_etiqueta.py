"""
Renderiza el ticket de precio para Leeka 1.54_BWRY.

Compone una imagen logica 200x200 con la paleta BWRY y la convierte al bitmap
de 10000 bytes que entiende el panel. Tambien exporta un preview PNG en alta
resolucion para revision visual del diseno antes de mandarlo a la etiqueta.

Uso (mockup):
    py scripts/esl/render_etiqueta.py preview

Uso (envio real, tras aprobacion del diseno):
    py scripts/esl/render_etiqueta.py send <MAC> <productJson>
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import random
import sys
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont
from barcode import Code128
from barcode.writer import ImageWriter

# --------------------------------------------------------------------------
# Paleta BWRY (RGB)
# --------------------------------------------------------------------------
COLOR_K = (0, 0, 0)        # 00 - Negro
COLOR_W = (255, 255, 255)  # 01 - Blanco
COLOR_Y = (255, 220, 0)    # 10 - Amarillo
COLOR_R = (220, 0, 0)      # 11 - Rojo

PALETTE_RGB = [COLOR_K, COLOR_W, COLOR_Y, COLOR_R]
PALETTE_BITS = {COLOR_K: 0b00, COLOR_W: 0b01, COLOR_Y: 0b10, COLOR_R: 0b11}

PANEL_W = 200
PANEL_H = 200
FRAME_BYTES = PANEL_W * PANEL_H * 2 // 8  # 10000


# --------------------------------------------------------------------------
# Modelo de datos
# --------------------------------------------------------------------------
@dataclass
class TicketData:
    name: str
    sku: str
    price: float
    original_price: float | None  # tachado encima
    tag_code: str  # codigo de barras inferior (deviceCode)
    currency: str = "S/"

    @property
    def offer_pct(self) -> int | None:
        if self.original_price and self.original_price > self.price:
            return round((1 - self.price / self.original_price) * 100)
        return None


# --------------------------------------------------------------------------
# Fuentes
# --------------------------------------------------------------------------
def _try_font(names: list[str], size: int) -> ImageFont.FreeTypeFont:
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def get_fonts():
    bold = ["arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"]
    reg = ["arial.ttf", "DejaVuSans.ttf"]
    return {
        "name": _try_font(bold, 22),
        "name_sm": _try_font(bold, 18),
        "sku": _try_font(reg, 12),
        "price_big": _try_font(bold, 42),
        "price_small": _try_font(reg, 14),
        "offer_lbl": _try_font(bold, 14),
        "currency": _try_font(bold, 18),
    }


# --------------------------------------------------------------------------
# Composicion del ticket (200x200, vista del cliente)
# --------------------------------------------------------------------------
def compose_ticket(d: TicketData) -> Image.Image:
    img = Image.new("RGB", (PANEL_W, PANEL_H), COLOR_W)
    draw = ImageDraw.Draw(img)
    F = get_fonts()

    # ---- Banner superior "OFERTA" (rojo con texto blanco) ----
    banner_h = 26
    draw.rectangle([0, 0, PANEL_W, banner_h], fill=COLOR_R)
    pct = d.offer_pct
    label = "OFERTA" + (f"  -{pct}%" if pct else "")
    bbox = draw.textbbox((0, 0), label, font=F["offer_lbl"])
    tw = bbox[2] - bbox[0]
    draw.text(((PANEL_W - tw) // 2, 5), label, fill=COLOR_W, font=F["offer_lbl"])

    # ---- Nombre del producto (negro, 2 lineas max) ----
    name_y = banner_h + 6
    name_font = F["name"]
    wrapped = _wrap_text(draw, d.name.upper(), name_font, PANEL_W - 8)
    if len(wrapped) > 2:
        name_font = F["name_sm"]
        wrapped = _wrap_text(draw, d.name.upper(), name_font, PANEL_W - 8)[:2]
    for i, line in enumerate(wrapped):
        bbox = draw.textbbox((0, 0), line, font=name_font)
        lw = bbox[2] - bbox[0]
        draw.text(((PANEL_W - lw) // 2, name_y + i * (name_font.size + 2)),
                  line, fill=COLOR_K, font=name_font)

    # ---- SKU (pequeno, negro) ----
    sku_y = name_y + len(wrapped) * (name_font.size + 2) + 2
    sku_text = f"SKU: {d.sku}"
    bbox = draw.textbbox((0, 0), sku_text, font=F["sku"])
    draw.text(((PANEL_W - (bbox[2] - bbox[0])) // 2, sku_y),
              sku_text, fill=COLOR_K, font=F["sku"])

    # ---- Precio original tachado (amarillo de fondo + negro) ----
    block_y = sku_y + 18
    if d.original_price and d.original_price > d.price:
        orig_text = f"{d.currency} {d.original_price:.2f}"
        bbox = draw.textbbox((0, 0), orig_text, font=F["price_small"])
        ow = bbox[2] - bbox[0]
        ox = (PANEL_W - ow) // 2
        # banda amarilla detras
        draw.rectangle([ox - 6, block_y - 2, ox + ow + 6, block_y + 16],
                       fill=COLOR_Y)
        draw.text((ox, block_y - 1), orig_text, fill=COLOR_K,
                  font=F["price_small"])
        # tachado en rojo
        draw.line([ox - 4, block_y + 7, ox + ow + 4, block_y + 7],
                  fill=COLOR_R, width=2)
        block_y += 18

    # ---- Precio destacado (rojo grande) ----
    price_text = f"{d.price:.2f}"
    pf = F["price_big"]
    bbox = draw.textbbox((0, 0), price_text, font=pf)
    pw = bbox[2] - bbox[0]
    cf = F["currency"]
    cbox = draw.textbbox((0, 0), d.currency, font=cf)
    cw = cbox[2] - cbox[0]
    total_w = cw + 4 + pw
    px = (PANEL_W - total_w) // 2
    py = block_y + 2
    draw.text((px, py + (pf.size - cf.size)), d.currency, fill=COLOR_R, font=cf)
    draw.text((px + cw + 4, py - 4), price_text, fill=COLOR_R, font=pf)

    # ---- Codigo de barras inferior (solo barras, sin texto) ----
    bc_h = 26
    bc_y = PANEL_H - bc_h
    bc_img = _render_barcode_bars(d.tag_code, PANEL_W - 8, bc_h - 4)
    img.paste(bc_img, (4, bc_y + 2))

    return img


def _wrap_text(draw: ImageDraw.ImageDraw, text: str,
               font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        cand = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), cand, font=font)
        if bbox[2] - bbox[0] <= max_w:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _render_barcode_bars(code: str, width: int, height: int) -> Image.Image:
    """Genera codigo de barras Code128 sin texto, escalado al ancho dado."""
    buf = io.BytesIO()
    Code128(code, writer=ImageWriter()).write(
        buf,
        options={
            "module_height": float(height),
            "module_width": 0.25,
            "quiet_zone": 1.0,
            "write_text": False,
            "background": "white",
            "foreground": "black",
        },
    )
    buf.seek(0)
    bc = Image.open(buf).convert("RGB")
    # binarizar -> blanco/negro puro
    bc = bc.point(lambda p: 0 if p < 128 else 255)
    # escalar al ancho objetivo manteniendo proporciones
    ratio = width / bc.width
    new_h = max(1, int(bc.height * ratio))
    bc = bc.resize((width, new_h), Image.NEAREST)
    # recortar/centrar a la altura objetivo
    canvas = Image.new("RGB", (width, height), COLOR_W)
    canvas.paste(bc, (0, (height - bc.height) // 2))
    return canvas


# --------------------------------------------------------------------------
# Cuantizacion + empaquetado a 10000 bytes
# --------------------------------------------------------------------------
def _nearest_palette_index(px: tuple[int, int, int]) -> int:
    best = 0
    bd = 10 ** 9
    for i, c in enumerate(PALETTE_RGB):
        d = (px[0] - c[0]) ** 2 + (px[1] - c[1]) ** 2 + (px[2] - c[2]) ** 2
        if d < bd:
            bd = d
            best = i
    # PALETTE_RGB orden: K(00), W(01), Y(10), R(11) -> indice == valor 2bpp
    return best


def quantize_to_bwry(img: Image.Image) -> Image.Image:
    """Cuantiza al palette BWRY usando vecino mas cercano (sin dithering)."""
    img = img.convert("RGB")
    out = Image.new("RGB", img.size)
    px_in = img.load()
    px_out = out.load()
    for y in range(img.height):
        for x in range(img.width):
            idx = _nearest_palette_index(px_in[x, y])
            px_out[x, y] = PALETTE_RGB[idx]
    return out


def pack_bwry_bitmap(img: Image.Image) -> bytes:
    """Convierte una imagen RGB 200x200 (ya cuantizada a la paleta BWRY) a
    los 10000 bytes que entiende el panel, incluyendo la rotacion 90 CW."""
    assert img.size == (PANEL_W, PANEL_H), f"esperado 200x200, vino {img.size}"
    rotated = img.rotate(-90, expand=False)  # CW
    px = rotated.load()
    out = bytearray(FRAME_BYTES)
    bytes_per_row = PANEL_W // 4
    for y in range(PANEL_H):
        for xb in range(bytes_per_row):
            byte = 0
            for k in range(4):
                v = _nearest_palette_index(px[xb * 4 + k, y])
                byte |= v << ((3 - k) * 2)
            out[y * bytes_per_row + xb] = byte
    return bytes(out)


def render_ticket_to_bitmap(d: TicketData) -> bytes:
    composed = compose_ticket(d)
    quantized = quantize_to_bwry(composed)
    return pack_bwry_bitmap(quantized)


# --------------------------------------------------------------------------
# Preview en alta resolucion
# --------------------------------------------------------------------------
def save_preview(d: TicketData, out_path: str, scale: int = 4) -> None:
    composed = compose_ticket(d)
    quantized = quantize_to_bwry(composed)
    big = quantized.resize((PANEL_W * scale, PANEL_H * scale), Image.NEAREST)
    # marco negro 2px
    framed = Image.new(
        "RGB",
        (big.width + 4, big.height + 4),
        COLOR_K,
    )
    framed.paste(big, (2, 2))
    framed.save(out_path)
    print(f"Preview -> {out_path}  ({framed.size[0]}x{framed.size[1]} px)")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
SAMPLE = TicketData(
    name="Gaseosa Inca Kola 1.5L",
    sku="INK-15L",
    price=8.90,
    original_price=12.50,
    tag_code="16637985",
)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["preview", "send"])
    p.add_argument("mac", nargs="?")
    p.add_argument("--name")
    p.add_argument("--sku")
    p.add_argument("--price", type=float)
    p.add_argument("--orig", type=float)
    p.add_argument("--code")
    p.add_argument("--out", default="scripts/esl/preview_etiqueta.png")
    args = p.parse_args()

    if any([args.name, args.sku, args.price, args.code]):
        d = TicketData(
            name=args.name or SAMPLE.name,
            sku=args.sku or SAMPLE.sku,
            price=args.price if args.price is not None else SAMPLE.price,
            original_price=args.orig if args.orig is not None
            else (args.price * random.uniform(1.2, 1.6)
                  if args.price else SAMPLE.original_price),
            tag_code=args.code or SAMPLE.tag_code,
        )
    else:
        d = SAMPLE

    if args.cmd == "preview":
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        save_preview(d, args.out)
        return

    if args.cmd == "send":
        if not args.mac:
            print("Falta MAC para send", file=sys.stderr)
            sys.exit(1)
        import asyncio
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from esl_leeka_send import LeekaClient  # type: ignore
        bitmap = render_ticket_to_bitmap(d)
        async def go():
            c = LeekaClient(args.mac)
            await c.connect()
            try:
                await c.send_image(bitmap)
                await asyncio.sleep(3.0)
            finally:
                await c.disconnect()
        asyncio.run(go())
        return


if __name__ == "__main__":
    main()
