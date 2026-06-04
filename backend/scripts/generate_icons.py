import os
import struct
import zlib


def make_png(width, height, color=(232, 129, 74)):  # #E8814A is (232, 129, 74)
    # Header
    png = b"\x89PNG\r\n\x1a\n"
    # IHDR
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png += (
        struct.pack(">I", 13)
        + b"IHDR"
        + ihdr_data
        + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data))
    )

    # IDAT
    raw_data = b""
    for _ in range(height):
        raw_data += b"\x00"  # Filter type 0
        raw_data += bytes(color) * width
    idat_data = zlib.compress(raw_data)
    png += (
        struct.pack(">I", len(idat_data))
        + b"IDAT"
        + idat_data
        + struct.pack(">I", zlib.crc32(b"IDAT" + idat_data))
    )

    # IEND
    png += struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND"))
    return png


def save_icons():
    icon_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..",
        "frontend",
        "public",
        "icons",
    )
    os.makedirs(icon_dir, exist_ok=True)

    with open(os.path.join(icon_dir, "icon-192.png"), "wb") as f:
        f.write(make_png(192, 192))
    with open(os.path.join(icon_dir, "icon-512.png"), "wb") as f:
        f.write(make_png(512, 512))
    print("PNG icons generated successfully!")


if __name__ == "__main__":
    save_icons()
