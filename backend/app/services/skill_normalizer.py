from __future__ import annotations

import re

SKILL_ALIASES = {
    'js': 'javascript',
    'javascript': 'javascript',
    'ts': 'typescript',
    'typescript': 'typescript',
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'node': 'node.js',
    'nodejs': 'node.js',
    'node js': 'node.js',
    'node.js': 'node.js',
    'react': 'react',
    'reactjs': 'react',
    'react js': 'react',
    'react.js': 'react',
    'machine learning': 'machine learning',
    'ml': 'machine learning',
    'fast api': 'fastapi',
    'fastapi': 'fastapi',
}

KNOWN_SKILLS = {
    'python', 'sql', 'fastapi', 'javascript', 'react', 'java', 'aws', 'docker',
    'kubernetes', 'postgresql', 'machine learning', 'etl', 'tableau', 'power bi',
    'typescript', 'node.js', 'c#', 'azure', 'devops', 'agile', 'ai', 'llm',
}


def normalize_skill(value: str) -> str:
    cleaned = re.sub(r'\s+', ' ', value.lower().replace('_', ' ').strip())
    cleaned = cleaned.strip(' .,;:()[]{}')
    return SKILL_ALIASES.get(cleaned, cleaned)


def extract_known_skills(text: str) -> list[str]:
    found: set[str] = set()
    lower_text = text.lower()
    aliases = set(SKILL_ALIASES) | KNOWN_SKILLS
    for alias in sorted(aliases, key=len, reverse=True):
        pattern = rf'(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])'
        if re.search(pattern, lower_text):
            found.add(normalize_skill(alias))
    return sorted(found)
