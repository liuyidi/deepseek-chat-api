def mask_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    value = ip.strip()
    if not value:
        return None
    if ":" in value:  # IPv6 — keep first 4 hextets-ish simply
        parts = value.split(":")
        kept = [p for p in parts if p][:3]
        return ":".join(kept) + ":***" if kept else "***"
    parts = value.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return f"{parts[0]}.{parts[1]}.{parts[2]}.***"
    return value
