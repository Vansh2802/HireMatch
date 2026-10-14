from app.services.skill_normalizer import extract_known_skills, normalize_skill


def test_skill_aliases_match_without_java_false_positive():
    assert normalize_skill('JS') == 'javascript'
    assert normalize_skill('Postgres') == 'postgresql'
    assert 'javascript' in extract_known_skills('Built JavaScript and React.js applications.')
    assert 'java' not in extract_known_skills('Built JavaScript applications.')


def test_skill_matching_handles_punctuation_and_duplicates():
    skills = extract_known_skills('Python, python; TS / TypeScript, and Node.js.')

    assert skills.count('python') == 1
    assert 'typescript' in skills
    assert 'node.js' in skills
