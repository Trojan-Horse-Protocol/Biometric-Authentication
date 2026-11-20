import re


USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,50}$")
EMAIL_RE = re.compile(
    r"^(?=.{1,254}$)(?=.{1,64}@)"
    r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
    r"(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@"
    r"(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+"
    r"[A-Za-z]{2,63}$"
)

IDENTIFIER_FORMAT_MESSAGE = (
    "Use a 3-50 character username (letters, numbers, underscores, "
    "or hyphens) or a valid email address."
)


def normalize_identifier(identifier: str) -> str:
    identifier = identifier.strip()
    return identifier.lower() if "@" in identifier else identifier


def is_valid_identifier(identifier: str) -> bool:
    return bool(USERNAME_RE.fullmatch(identifier) or EMAIL_RE.fullmatch(identifier))
