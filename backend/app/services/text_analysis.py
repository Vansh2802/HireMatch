"""Deterministic text utilities shared by resume extraction, job extraction and matching."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

# ---------------------------------------------------------------- sections

RESUME_SECTIONS: dict[str, tuple[str, ...]] = {
    'summary': ('summary', 'professional summary', 'profile', 'professional profile', 'about me', 'about', 'objective', 'career objective', 'career summary', 'personal statement'),
    'experience': ('experience', 'work experience', 'professional experience', 'employment history', 'work history', 'employment', 'career history', 'relevant experience', 'professional background', 'internships', 'internship experience'),
    'education': ('education', 'academic background', 'education and training', 'academic qualifications', 'education & training', 'academics'),
    'skills': ('skills', 'technical skills', 'core competencies', 'key skills', 'technologies', 'tech stack', 'tools', 'skills and tools', 'skills & tools', 'areas of expertise', 'competencies', 'core skills', 'technical proficiencies', 'skills summary', 'tools and technologies', 'tools & technologies'),
    'projects': ('projects', 'personal projects', 'selected projects', 'key projects', 'academic projects', 'side projects', 'project experience'),
    'certifications': ('certifications', 'certificates', 'licenses', 'licenses and certifications', 'licenses & certifications', 'certifications and licenses', 'certifications & licenses', 'courses', 'training', 'courses and certifications'),
    'other': ('awards', 'honors', 'honours', 'achievements', 'publications', 'volunteer', 'volunteering', 'volunteer experience', 'languages', 'interests', 'hobbies', 'references', 'activities', 'leadership', 'extracurricular activities'),
}

JOB_SECTIONS: dict[str, tuple[str, ...]] = {
    'responsibilities': ('responsibilities', 'key responsibilities', 'what you will do', "what you'll do", 'what you’ll do', 'your role', 'duties', 'job duties', 'in this role you will', 'day to day', 'your responsibilities', 'what you will be doing', "what you'll be doing"),
    'required': ('requirements', 'required qualifications', 'minimum qualifications', 'basic qualifications', 'qualifications', 'must have', 'must haves', 'must-have', 'what you bring', "what you'll bring", 'what we are looking for', "what we're looking for", 'who you are', 'required skills', 'you have', 'skills and experience', 'skills & experience', 'experience', 'requirements and qualifications', 'about you', 'what you need', 'key requirements', 'essential', 'essential skills', 'essential criteria'),
    'preferred': ('preferred qualifications', 'nice to have', 'nice-to-have', 'nice to haves', 'bonus points', 'bonus', 'preferred', 'preferred skills', 'pluses', 'it would be great if', 'desirable', 'desirable skills', 'additional qualifications', 'good to have', 'bonus if you have', 'extra credit', 'desired qualifications', 'desired skills'),
    # Descriptive intros: their prose is not a list of duties or requirements.
    'other': ('about the role', 'the role', 'role overview', 'the opportunity', 'about us', 'about the company', 'benefits', 'perks', 'what we offer', 'compensation', 'salary', 'equal opportunity', 'how to apply', 'our values', 'why join us', 'company overview', 'who we are', 'location', 'perks and benefits'),
}


@dataclass
class Section:
    key: str
    heading: str
    line_start: int  # first content line (index into lines)
    line_end: int  # exclusive


def _heading_key(line: str, catalogue: dict[str, tuple[str, ...]]) -> str | None:
    stripped = line.strip().strip('#*•-–—:| ').strip()
    if not stripped or len(stripped) > 45:
        return None
    normalized = re.sub(r'[^a-z&\' ’-]', '', stripped.lower()).strip()
    normalized = re.sub(r'\s+', ' ', normalized)
    for key, names in catalogue.items():
        if normalized in names:
            return key
    return None


def split_sections(text: str, catalogue: dict[str, tuple[str, ...]]) -> tuple[list[str], list[Section]]:
    lines = text.split('\n')
    markers: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        key = _heading_key(line, catalogue)
        if key:
            markers.append((index, key, line.strip()))
    sections: list[Section] = []
    for position, (index, key, heading) in enumerate(markers):
        end = markers[position + 1][0] if position + 1 < len(markers) else len(lines)
        sections.append(Section(key=key, heading=heading, line_start=index + 1, line_end=end))
    return lines, sections


def section_text(lines: list[str], sections: list[Section], key: str) -> str:
    return '\n'.join('\n'.join(lines[s.line_start:s.line_end]) for s in sections if s.key == key).strip()


def section_line_indexes(sections: list[Section], key: str) -> set[int]:
    return {index for s in sections if s.key == key for index in range(s.line_start, s.line_end)}


# ---------------------------------------------------------------- dates & experience

_MONTHS = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
    'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}
_MONTH_RE = r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?'
_DATE_RE = rf'(?:{_MONTH_RE}\s*,?\s*(?:19|20)\d{{2}}|(?:0?[1-9]|1[0-2])\s*[/.-]\s*(?:19|20)\d{{2}}|(?:19|20)\d{{2}})'
_RANGE_RE = re.compile(
    rf'(?P<start>{_DATE_RE})\s*(?:-|–|—|to|until|till|through)\s*(?P<end>{_DATE_RE}|present|current|now|today|date|ongoing)',
    re.IGNORECASE,
)
_STATED_YEARS_RE = re.compile(
    r'(?P<years>\d{1,2}(?:\.\d)?)\s*\+?\s*(?:plus\s+)?(?:years?|yrs?)\b(?:\s+of)?(?:\s+[a-z/&-]+){0,4}?\s+experience',
    re.IGNORECASE,
)
_EDUCATION_LINE_RE = re.compile(r'\b(university|college|school|institute|academy|bachelor|master|degree|b\.?sc|m\.?sc|ph\.?d|gpa|graduat)', re.IGNORECASE)


def _parse_date(value: str, *, today: date) -> tuple[int, int] | None:
    value = value.strip().lower()
    if value in {'present', 'current', 'now', 'today', 'date', 'ongoing'}:
        return today.year, today.month
    numeric = re.fullmatch(r'(\d{1,2})\s*[/.-]\s*(\d{4})', value)
    if numeric:
        return int(numeric.group(2)), int(numeric.group(1))
    year_match = re.search(r'(19|20)\d{2}', value)
    if not year_match:
        return None
    year = int(year_match.group(0))
    word = re.match(r'([a-z]+)', value)
    if word:
        month = _MONTHS.get(word.group(1)[:4]) or _MONTHS.get(word.group(1)[:3])
        if month:
            return year, month
    # Year only: count from January to January so "2018 – 2020" is two years.
    return year, 1


@dataclass
class DateRange:
    start: tuple[int, int]
    end: tuple[int, int]
    line: int
    text: str

    @property
    def months(self) -> int:
        return (self.end[0] - self.start[0]) * 12 + (self.end[1] - self.start[1])


def find_date_ranges(lines: list[str], *, allowed_lines: set[int] | None = None, today: date | None = None) -> list[DateRange]:
    today = today or date.today()
    ranges: list[DateRange] = []
    for index, line in enumerate(lines):
        if allowed_lines is not None and index not in allowed_lines:
            continue
        for match in _RANGE_RE.finditer(line):
            start = _parse_date(match.group("start"), today=today)
            end = _parse_date(match.group("end"), today=today)
            if not start or not end:
                continue
            if end < start or start[0] < 1960 or end > (today.year, today.month) or (end[0] - start[0]) > 45:
                continue
            ranges.append(DateRange(start=start, end=end, line=index, text=match.group(0)))
    return ranges


def merged_months(ranges: list[DateRange]) -> int:
    """Total months covered by the ranges, counting overlapping periods once."""
    intervals = sorted((r.start[0] * 12 + r.start[1], r.end[0] * 12 + r.end[1]) for r in ranges)
    total = 0
    current_start, current_end = None, None
    for start, end in intervals:
        end = max(end, start + 1)  # a role that starts and ends in the same month still counts
        if current_end is None or start > current_end:
            if current_end is not None:
                total += current_end - current_start
            current_start, current_end = start, end
        else:
            current_end = max(current_end, end)
    if current_end is not None:
        total += current_end - current_start
    return total


def stated_experience_years(text: str) -> tuple[float, str] | None:
    best: tuple[float, str] | None = None
    for match in _STATED_YEARS_RE.finditer(text):
        years = float(match.group('years'))
        if 0 < years <= 45 and (best is None or years > best[0]):
            best = (years, match.group(0))
    return best


def estimate_experience(text: str, *, today: date | None = None) -> dict:
    """Estimate total professional experience from dated roles, falling back to stated years.

    Returns ``{'years', 'source', 'evidence', 'warning'}``; ``years`` is ``None`` when the
    resume does not give enough information (never guessed).
    """
    lines, sections = split_sections(text, RESUME_SECTIONS)
    experience_lines = section_line_indexes(sections, 'experience')
    if experience_lines:
        allowed = experience_lines
    else:
        excluded = section_line_indexes(sections, 'education') | section_line_indexes(sections, 'certifications') | section_line_indexes(sections, 'projects')
        allowed = {
            index for index, line in enumerate(lines)
            if index not in excluded and not _EDUCATION_LINE_RE.search(line)
        }
    ranges = find_date_ranges(lines, allowed_lines=allowed, today=today)
    stated = stated_experience_years(text)
    warning = None
    if ranges:
        years = round(merged_months(ranges) / 12 * 2) / 2
        if stated and abs(stated[0] - years) >= 2:
            warning = (
                f'Your resume states "{stated[1].strip()}", but the dated roles add up to about {years:g} years. '
                'Reviewers may notice the difference; consider listing all relevant roles with dates.'
            )
        return {
            'years': years,
            'source': 'date_ranges',
            'evidence': [lines[r.line].strip()[:240] for r in ranges[:6]],
            'warning': warning,
        }
    if stated:
        return {'years': stated[0], 'source': 'stated', 'evidence': [stated[1].strip()], 'warning': None}
    return {'years': None, 'source': None, 'evidence': [], 'warning': None}


# ---------------------------------------------------------------- education

_DEGREE_PATTERNS: list[tuple[int, re.Pattern[str]]] = [
    (4, re.compile(r'\b(ph\.?\s?d\.?|doctorate|doctoral degree|doctor of philosophy|d\.phil)', re.IGNORECASE)),
    (3, re.compile(r"(\bmaster(?:'s|’s|s)\b|\bmaster of\b|\bmasters? degree\b|\bm\.s\.|\bmsc\b|\bm\.sc\b|\bmba\b|\bm\.eng\b|\bmeng\b|\bm\.tech\b|\bmtech\b|\bm\.a\.|\bpostgraduate degree\b)", re.IGNORECASE)),
    (2, re.compile(r"(\bbachelor(?:'s|’s|s)?\b|\bb\.s\.|\bbsc\b|\bb\.sc\b|\bb\.a\.|\bb\.eng\b|\bbeng\b|\bb\.tech\b|\bbtech\b|\bb\.e\.|\bundergraduate degree\b|\b(?:ba|bs)\s+(?:in|of)\b|\bbachelors\b|\b4-year degree\b|\bfour-year degree\b|\buniversity degree\b|\bcollege degree\b)", re.IGNORECASE)),
    (1, re.compile(r"(\bassociate(?:'s|’s)? degree\b|\ba\.a\.s?\.|\bhnd\b|\bdiploma\b)", re.IGNORECASE)),
]
DEGREE_LABELS = {1: 'Associate degree or diploma', 2: "Bachelor's degree", 3: "Master's degree", 4: 'Doctorate'}


def degree_level(text: str) -> int | None:
    for level, pattern in _DEGREE_PATTERNS:
        if pattern.search(text):
            return level
    if re.search(r'\bdegree\b', text, re.IGNORECASE):
        return 2
    return None


def highest_degree(text: str) -> tuple[int, str] | None:
    """Highest degree level mentioned in ``text`` with the line that mentions it."""
    best: tuple[int, str] | None = None
    for line in text.split('\n'):
        for level, pattern in _DEGREE_PATTERNS:
            if pattern.search(line):
                if best is None or level > best[0]:
                    best = (level, line.strip()[:240])
                break
    return best


# ---------------------------------------------------------------- token overlap

_STOPWORDS = set(
    """a an and are as at be been being but by can could did do does for from had has have having he her his i if in into is it its
    me my of on or our out over so such than that the their them then there these they this those to too under up us was we were
    what when where which while who will with would you your yours about across after all also any around both each either etc
    including like more most must new not one only other per same should some through via within without work working ability able
    strong excellent good great well team teams role candidate candidates experience experienced years year using use used plus
    including related relevant knowledge skills skill understanding familiarity proficiency proficient demonstrated proven
    opportunity company business ensure responsible responsibilities various multiple key day""".split()
)


def _stem(word: str) -> str:
    for suffix, min_len in (('ing', 6), ('ed', 5), ('es', 5), ('s', 4)):
        if word.endswith(suffix) and len(word) >= min_len:
            return word[: -len(suffix)]
    return word


def content_tokens(text: str) -> set[str]:
    words = re.findall(r'[a-z][a-z0-9+#.]*[a-z0-9+#]|[a-z]', text.lower())
    return {_stem(word) for word in words if len(word) > 2 and word not in _STOPWORDS}


def best_matching_line(requirement_tokens: set[str], lines: list[str], *, min_overlap: int = 2) -> tuple[str, int, int] | None:
    best: tuple[str, int, int] | None = None
    for index, line in enumerate(lines):
        if len(line.strip()) < 12:
            continue
        overlap = len(requirement_tokens & content_tokens(line))
        if overlap >= min_overlap and (best is None or overlap > best[2]):
            best = (line.strip()[:280], index, overlap)
    return best


def excerpt_around(text: str, start: int, end: int, *, width: int = 110) -> tuple[str, int]:
    """Return the line containing [start, end) (trimmed to ``width`` chars each side) and its line index."""
    line_start = text.rfind('\n', 0, start) + 1
    line_end = text.find('\n', end)
    if line_end == -1:
        line_end = len(text)
    left = max(line_start, start - width)
    right = min(line_end, end + width)
    snippet = text[left:right].strip()
    if left > line_start:
        snippet = '…' + snippet
    if right < line_end:
        snippet = snippet + '…'
    return snippet, text.count('\n', 0, start)
