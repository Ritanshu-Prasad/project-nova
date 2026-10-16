import io


def make_pdf(pages, bookmarks=None) -> bytes:
    """A small PDF: `pages` is a text (or list of texts, one per page); `bookmarks` is a list of (title, page number)."""
    pages = [pages] if isinstance(pages, str) else pages
    bookmarks = bookmarks or []
    first_page = 4
    outline_root = first_page + 2 * len(pages)
    objects = {
        1: f"<</Type/Catalog/Pages 2 0 R{f' /Outlines {outline_root} 0 R' if bookmarks else ''}>>",
        2: f"<</Type/Pages/Kids[{' '.join(f'{first_page + 2 * i} 0 R' for i in range(len(pages)))}]/Count {len(pages)}>>",
        3: "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    }
    for i, text in enumerate(pages):
        lines = " 0 -14 Td ".join(f"({line}) Tj" for line in text.split("\n"))
        stream = f"BT /F1 12 Tf 50 700 Td {lines} ET"
        objects[first_page + 2 * i] = f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents {first_page + 2 * i + 1} 0 R/Resources<</Font<</F1 3 0 R>>>>>>"
        objects[first_page + 2 * i + 1] = f"<</Length {len(stream)}>>\nstream\n{stream}\nendstream"
    if bookmarks:
        item = lambda j: outline_root + 1 + j
        objects[outline_root] = f"<</Type/Outlines/First {item(0)} 0 R/Last {item(len(bookmarks) - 1)} 0 R/Count {len(bookmarks)}>>"
        for j, (title, number) in enumerate(bookmarks):
            links = (f" /Prev {item(j - 1)} 0 R" if j else "") + (f" /Next {item(j + 1)} 0 R" if j < len(bookmarks) - 1 else "")
            objects[item(j)] = f"<</Title ({title}) /Parent {outline_root} 0 R /Dest [{first_page + 2 * (number - 1)} 0 R /Fit]{links}>>"
    out = io.StringIO()
    out.write("%PDF-1.4\n")
    offsets = {}
    for number in sorted(objects):
        offsets[number] = out.tell()
        out.write(f"{number} 0 obj\n{objects[number]}\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
    out.writelines(f"{offsets[number]:010d} 00000 n \n" for number in sorted(objects))
    out.write(f"trailer\n<</Size {len(objects) + 1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF")
    return out.getvalue().encode()
