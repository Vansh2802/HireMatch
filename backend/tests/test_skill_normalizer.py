from app.services.skill_normalizer import extract_known_skills, implied_skills, normalize_skill


def test_skill_aliases_match_without_java_false_positive():
    assert normalize_skill('JS') == 'javascript'
    assert normalize_skill('Postgres') == 'postgresql'
    assert normalize_skill('React.js') == 'react'
    assert 'javascript' in extract_known_skills('Built JavaScript and React.js applications.')
    assert 'java' not in extract_known_skills('Built JavaScript applications.')


def test_skill_matching_handles_punctuation_and_duplicates():
    skills = extract_known_skills('Python, python; TypeScript, and Node.js.')
    assert skills.count('python') == 1
    assert {'typescript', 'node.js'} <= set(skills)


def test_ambiguous_words_are_not_skills():
    assert 'excel' not in extract_known_skills('I excel at stakeholder communication.')
    assert 'excel' in extract_known_skills('Advanced Excel modelling')
    assert 'sql' not in extract_known_skills('Managed MySQL databases')
    assert 'swift' not in extract_known_skills('Delivered swift turnaround for clients')


def test_implied_skills_are_transitive():
    assert {'react', 'javascript'} <= implied_skills('next.js')
    assert 'sql' in implied_skills('postgresql')
