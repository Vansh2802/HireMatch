"""Skill taxonomy, alias normalisation and text matching.

The taxonomy is intentionally explicit: every canonical skill lists the aliases
that count as the same skill, an optional *family* of closely related skills
(used for partial credit, e.g. MySQL vs PostgreSQL) and the skills it *implies*
(e.g. PostgreSQL experience is evidence of SQL). Matching is word-boundary
aware so that "Java" never matches "JavaScript" and "SQL" never matches "MySQL".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache


@dataclass(frozen=True)
class SkillDef:
    key: str
    label: str
    family: str | None = None
    aliases: tuple[str, ...] = ()
    case_sensitive_aliases: tuple[str, ...] = ()
    implies: tuple[str, ...] = ()
    all_aliases: tuple[str, ...] = field(default=(), compare=False)


def _s(key, label, family=None, aliases=(), cs=(), implies=()):
    return SkillDef(key, label, family, tuple(aliases), tuple(cs), tuple(implies))


_SKILLS: list[SkillDef] = [
    # Programming languages
    _s('python', 'Python', aliases=['python3', 'python 3']),
    _s('java', 'Java', aliases=['java 8', 'java 11', 'java 17', 'core java']),
    _s('javascript', 'JavaScript', 'js_lang', ['js', 'ecmascript', 'es6', 'vanilla js']),
    _s('typescript', 'TypeScript', 'js_lang', ['ts'], implies=['javascript']),
    _s('c++', 'C++', 'c_lang', ['cpp', 'c plus plus']),
    _s('c', 'C', 'c_lang', ['c programming', 'ansi c', 'embedded c']),
    _s('c#', 'C#', 'dotnet_lang', ['csharp', 'c sharp']),
    _s('go', 'Go', aliases=['golang', 'go lang']),
    _s('rust', 'Rust', cs=['Rust']),
    _s('ruby', 'Ruby', cs=['Ruby']),
    _s('php', 'PHP'),
    _s('kotlin', 'Kotlin', 'jvm_lang'),
    _s('scala', 'Scala', 'jvm_lang'),
    _s('swift', 'Swift', cs=['Swift', 'SwiftUI']),
    _s('objective-c', 'Objective-C', aliases=['objective c', 'objc']),
    _s('r', 'R', aliases=['r programming', 'rstudio', 'r language', 'tidyverse']),
    _s('matlab', 'MATLAB'),
    _s('dart', 'Dart', cs=['Dart']),
    _s('bash', 'Bash / Shell scripting', 'shell', ['shell scripting', 'shell script', 'bash scripting', 'zsh']),
    _s('powershell', 'PowerShell', 'shell'),
    _s('sql', 'SQL', aliases=['t-sql', 'tsql', 'pl/sql', 'plsql', 'ansi sql', 'sql queries']),
    _s('html', 'HTML', aliases=['html5']),
    _s('css', 'CSS', aliases=['css3', 'scss', 'sass', 'less css']),
    # Frontend
    _s('react', 'React', 'frontend_framework', ['reactjs', 'react.js', 'react js'], implies=['javascript']),
    _s('next.js', 'Next.js', 'frontend_framework', ['nextjs', 'next js'], implies=['react', 'javascript']),
    _s('angular', 'Angular', 'frontend_framework', ['angularjs', 'angular.js'], implies=['javascript']),
    _s('vue', 'Vue.js', 'frontend_framework', ['vue.js', 'vuejs', 'vue js', 'nuxt', 'nuxt.js'], implies=['javascript']),
    _s('svelte', 'Svelte', 'frontend_framework', ['sveltekit'], implies=['javascript']),
    _s('redux', 'Redux', aliases=['redux toolkit']),
    _s('tailwind', 'Tailwind CSS', aliases=['tailwindcss', 'tailwind css'], implies=['css']),
    _s('react native', 'React Native', 'mobile_framework', ['react-native'], implies=['react', 'javascript']),
    _s('flutter', 'Flutter', 'mobile_framework', implies=['dart']),
    _s('ios', 'iOS development', aliases=['ios development', 'uikit']),
    _s('android', 'Android development', aliases=['android development', 'android sdk']),
    # Backend frameworks
    _s('node.js', 'Node.js', 'js_backend', ['node', 'nodejs', 'node js'], implies=['javascript']),
    _s('express', 'Express', 'js_backend', ['express.js', 'expressjs'], implies=['node.js', 'javascript']),
    _s('nestjs', 'NestJS', 'js_backend', ['nest.js'], implies=['node.js', 'typescript']),
    _s('django', 'Django', 'python_web', ['django rest framework', 'drf'], implies=['python']),
    _s('flask', 'Flask', 'python_web', implies=['python']),
    _s('fastapi', 'FastAPI', 'python_web', ['fast api'], implies=['python']),
    _s('spring boot', 'Spring Boot', 'java_web', ['spring framework', 'springboot', 'spring mvc'], implies=['java']),
    _s('.net', '.NET', 'dotnet', ['dotnet', 'asp.net', '.net core', 'asp.net core', 'dot net'], implies=['c#']),
    _s('ruby on rails', 'Ruby on Rails', aliases=['rails', 'ror'], implies=['ruby']),
    _s('laravel', 'Laravel', implies=['php']),
    _s('graphql', 'GraphQL'),
    _s('rest api', 'REST APIs', aliases=['rest', 'restful', 'restful api', 'restful apis', 'rest apis', 'rest services']),
    _s('grpc', 'gRPC'),
    _s('microservices', 'Microservices', aliases=['microservice architecture', 'micro-services']),
    # Databases
    _s('postgresql', 'PostgreSQL', 'relational_db', ['postgres', 'postgre sql', 'psql'], implies=['sql']),
    _s('mysql', 'MySQL', 'relational_db', implies=['sql']),
    _s('sql server', 'SQL Server', 'relational_db', ['mssql', 'ms sql', 'microsoft sql server'], implies=['sql']),
    _s('oracle database', 'Oracle Database', 'relational_db', ['oracle db', 'oracle sql', 'oracle 19c'], implies=['sql']),
    _s('sqlite', 'SQLite', 'relational_db', implies=['sql']),
    _s('mariadb', 'MariaDB', 'relational_db', implies=['sql']),
    _s('mongodb', 'MongoDB', 'nosql_db', ['mongo', 'mongoose']),
    _s('dynamodb', 'DynamoDB', 'nosql_db', ['dynamo db']),
    _s('cassandra', 'Cassandra', 'nosql_db', ['apache cassandra']),
    _s('redis', 'Redis', 'cache'),
    _s('elasticsearch', 'Elasticsearch', 'search_engine', ['elastic search', 'opensearch', 'elk stack']),
    _s('snowflake', 'Snowflake', 'data_warehouse'),
    _s('bigquery', 'BigQuery', 'data_warehouse', ['google bigquery']),
    _s('redshift', 'Redshift', 'data_warehouse', ['amazon redshift']),
    _s('databricks', 'Databricks', 'data_warehouse'),
    # Cloud & DevOps
    _s('aws', 'AWS', 'cloud', ['amazon web services', 'ec2', 's3', 'aws lambda', 'lambda functions', 'cloudwatch']),
    _s('azure', 'Microsoft Azure', 'cloud', ['microsoft azure', 'azure devops', 'azure functions']),
    _s('gcp', 'Google Cloud', 'cloud', ['google cloud', 'google cloud platform', 'gcp']),
    _s('docker', 'Docker', 'containers', ['dockerfile', 'docker compose', 'docker-compose', 'containerization', 'containerisation']),
    _s('kubernetes', 'Kubernetes', 'orchestration', ['k8s', 'eks', 'aks', 'gke', 'helm', 'openshift']),
    _s('terraform', 'Terraform', 'iac'),
    _s('cloudformation', 'CloudFormation', 'iac', ['aws cloudformation', 'aws cdk']),
    _s('ansible', 'Ansible', 'config_mgmt'),
    _s('ci/cd', 'CI/CD', 'ci_cd', ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'ci/cd pipelines']),
    _s('jenkins', 'Jenkins', 'ci_cd', implies=['ci/cd']),
    _s('github actions', 'GitHub Actions', 'ci_cd', implies=['ci/cd']),
    _s('gitlab ci', 'GitLab CI', 'ci_cd', ['gitlab ci/cd', 'gitlab pipelines'], implies=['ci/cd']),
    _s('circleci', 'CircleCI', 'ci_cd', implies=['ci/cd']),
    _s('linux', 'Linux', aliases=['unix', 'ubuntu', 'centos', 'red hat', 'rhel', 'debian']),
    _s('git', 'Git', aliases=['github', 'gitlab', 'bitbucket', 'version control']),
    _s('devops', 'DevOps'),
    _s('sre', 'Site Reliability Engineering', aliases=['site reliability engineering', 'site reliability']),
    _s('prometheus', 'Prometheus', 'observability'),
    _s('grafana', 'Grafana', 'observability'),
    _s('datadog', 'Datadog', 'observability'),
    _s('nginx', 'Nginx'),
    # Data & ML
    _s('machine learning', 'Machine Learning', aliases=['ml', 'machine-learning']),
    _s('deep learning', 'Deep Learning', aliases=['neural networks', 'neural network'], implies=['machine learning']),
    _s('nlp', 'Natural Language Processing', aliases=['natural language processing']),
    _s('computer vision', 'Computer Vision', aliases=['opencv']),
    _s('llm', 'Large Language Models', aliases=['large language models', 'large language model', 'llms', 'generative ai', 'genai', 'prompt engineering', 'rag']),
    _s('tensorflow', 'TensorFlow', 'ml_framework', ['keras'], implies=['machine learning', 'python']),
    _s('pytorch', 'PyTorch', 'ml_framework', ['torch'], implies=['machine learning', 'python']),
    _s('scikit-learn', 'scikit-learn', 'ml_framework', ['sklearn', 'scikit learn'], implies=['machine learning', 'python']),
    _s('pandas', 'pandas', 'python_data', implies=['python']),
    _s('numpy', 'NumPy', 'python_data', implies=['python']),
    _s('spark', 'Apache Spark', 'big_data', ['apache spark', 'pyspark', 'spark sql'], cs=['Spark']),
    _s('hadoop', 'Hadoop', 'big_data', ['hdfs', 'hive', 'mapreduce']),
    _s('kafka', 'Kafka', 'messaging', ['apache kafka']),
    _s('rabbitmq', 'RabbitMQ', 'messaging'),
    _s('airflow', 'Apache Airflow', 'orchestration_data', ['apache airflow']),
    _s('dbt', 'dbt', 'orchestration_data', ['data build tool']),
    _s('etl', 'ETL', aliases=['elt', 'etl pipelines', 'data pipelines', 'data pipeline']),
    _s('data analysis', 'Data analysis', aliases=['data analytics', 'data analyst', 'analyzing data', 'analysing data']),
    _s('statistics', 'Statistics', aliases=['statistical analysis', 'statistical modeling', 'statistical modelling', 'a/b testing', 'hypothesis testing']),
    _s('tableau', 'Tableau', 'bi'),
    _s('power bi', 'Power BI', 'bi', ['powerbi', 'power-bi']),
    _s('looker', 'Looker', 'bi', ['looker studio', 'google data studio']),
    _s('excel', 'Microsoft Excel', 'spreadsheet', ['microsoft excel', 'ms excel', 'advanced excel', 'vlookup', 'pivot tables', 'pivot table'], cs=['Excel']),
    _s('google sheets', 'Google Sheets', 'spreadsheet'),
    # Testing & quality
    _s('unit testing', 'Unit testing', aliases=['unit tests', 'test-driven development', 'tdd']),
    _s('pytest', 'pytest', implies=['unit testing', 'python']),
    _s('jest', 'Jest', 'js_testing', implies=['unit testing']),
    _s('vitest', 'Vitest', 'js_testing', implies=['unit testing']),
    _s('cypress', 'Cypress', 'e2e_testing'),
    _s('selenium', 'Selenium', 'e2e_testing', ['webdriver']),
    _s('playwright', 'Playwright', 'e2e_testing'),
    _s('junit', 'JUnit', implies=['unit testing', 'java']),
    # Security
    _s('cybersecurity', 'Cybersecurity', aliases=['information security', 'infosec', 'cyber security', 'application security', 'appsec']),
    _s('oauth', 'OAuth / OpenID Connect', aliases=['oauth2', 'oauth 2.0', 'openid connect', 'oidc', 'saml', 'sso']),
    # Product, design & delivery
    _s('agile', 'Agile', 'methodology', ['agile methodologies', 'agile methodology']),
    _s('scrum', 'Scrum', 'methodology', ['scrum master'], implies=['agile']),
    _s('kanban', 'Kanban', 'methodology'),
    _s('jira', 'Jira', 'pm_tools', ['atlassian jira']),
    _s('confluence', 'Confluence', 'docs_tools'),
    _s('figma', 'Figma', 'design_tools'),
    _s('sketch', 'Sketch', 'design_tools', cs=['Sketch']),
    _s('adobe xd', 'Adobe XD', 'design_tools'),
    _s('adobe photoshop', 'Adobe Photoshop', 'creative_tools', ['photoshop']),
    _s('adobe illustrator', 'Adobe Illustrator', 'creative_tools', ['illustrator']),
    _s('ux research', 'UX research', aliases=['user research', 'usability testing', 'user interviews']),
    _s('ui design', 'UI design', aliases=['user interface design', 'interaction design', 'visual design']),
    _s('product management', 'Product management', aliases=['product manager', 'product roadmap', 'roadmapping', 'product strategy']),
    _s('project management', 'Project management', aliases=['project manager', 'pmp', 'prince2']),
    _s('stakeholder management', 'Stakeholder management', aliases=['stakeholder communication', 'stakeholder engagement']),
    # Business, marketing & sales
    _s('seo', 'SEO', aliases=['search engine optimization', 'search engine optimisation']),
    _s('sem', 'SEM / paid search', aliases=['google ads', 'adwords', 'ppc', 'paid search']),
    _s('google analytics', 'Google Analytics', aliases=['ga4', 'universal analytics']),
    _s('content marketing', 'Content marketing', aliases=['content strategy', 'copywriting']),
    _s('social media marketing', 'Social media marketing', aliases=['social media management', 'social media strategy']),
    _s('email marketing', 'Email marketing', aliases=['mailchimp', 'marketing automation']),
    _s('salesforce', 'Salesforce', 'crm', ['salesforce crm', 'sfdc']),
    _s('hubspot', 'HubSpot', 'crm'),
    _s('financial modeling', 'Financial modeling', aliases=['financial modelling', 'financial models', 'dcf', 'valuation models']),
    _s('accounting', 'Accounting', aliases=['bookkeeping', 'gaap', 'ifrs', 'accounts payable', 'accounts receivable']),
    _s('quickbooks', 'QuickBooks'),
    _s('sap', 'SAP', aliases=['sap erp', 'sap s/4hana', 's/4hana'], cs=['SAP']),
    _s('customer service', 'Customer service', aliases=['customer support', 'client support']),
    _s('technical writing', 'Technical writing', aliases=['documentation writing', 'api documentation']),
]


def _build() -> tuple[dict[str, SkillDef], dict[str, str]]:
    by_key: dict[str, SkillDef] = {}
    alias_to_key: dict[str, str] = {}
    for skill in _SKILLS:
        names = {skill.key, skill.label.lower(), *(alias.lower() for alias in skill.aliases)}
        by_key[skill.key] = SkillDef(
            skill.key,
            skill.label,
            skill.family,
            skill.aliases,
            skill.case_sensitive_aliases,
            skill.implies,
            tuple(sorted(names, key=len, reverse=True)),
        )
        for name in names:
            alias_to_key.setdefault(_clean(name), skill.key)
    return by_key, alias_to_key


def _clean(value: str) -> str:
    cleaned = re.sub(r'\s+', ' ', value.lower().replace('_', ' ').strip())
    return cleaned.strip(' ,;:()[]{}"\'').rstrip('.')


# Single letters and very short words are too ambiguous to search for in free text;
# they still normalise correctly when they arrive as an explicit skill list entry.
_FREE_TEXT_EXCLUDED = {'c', 'r', 'go', 'ts', 'js', 'ml', 'rest', 'rag', 'node', 'torch', 'rails', 'ror', 'drf', 'dcf', 'elt', 'sso', 'ppc'}
_SAFE_SHORT_IN_CONTEXT = {'js', 'ts', 'ml', 'node'}

SKILLS, _ALIAS_TO_KEY = _build()


def normalize_skill(value: str) -> str:
    """Return the canonical key for a skill name, or a cleaned lower-case string if unknown."""
    cleaned = _clean(value)
    return _ALIAS_TO_KEY.get(cleaned, cleaned)


def skill_label(key: str) -> str:
    skill = SKILLS.get(key)
    if skill:
        return skill.label
    return key[:1].upper() + key[1:] if key else key


def skill_family(key: str) -> str | None:
    skill = SKILLS.get(key)
    return skill.family if skill else None


def implied_skills(key: str) -> set[str]:
    """Skills that are evidenced transitively by having ``key`` (not including ``key``)."""
    seen: set[str] = set()
    stack = list(SKILLS[key].implies) if key in SKILLS else []
    while stack:
        item = stack.pop()
        if item in seen:
            continue
        seen.add(item)
        if item in SKILLS:
            stack.extend(SKILLS[item].implies)
    return seen


def _alias_pattern(alias: str) -> str:
    return rf'(?<![A-Za-z0-9+#/]){re.escape(alias)}(?![A-Za-z0-9+#])'


@lru_cache(maxsize=4096)
def _patterns_for(key: str, include_short: bool) -> tuple[re.Pattern[str], ...]:
    skill = SKILLS.get(key)
    patterns: list[re.Pattern[str]] = []
    if skill is None:
        if key and len(key) > 1:
            patterns.append(re.compile(_alias_pattern(key), re.IGNORECASE))
        return tuple(patterns)
    case_sensitive_lower = {alias.lower() for alias in skill.case_sensitive_aliases}
    for alias in skill.all_aliases:
        if alias in _FREE_TEXT_EXCLUDED and not (include_short and alias in _SAFE_SHORT_IN_CONTEXT):
            continue
        if len(alias) == 1 or alias in case_sensitive_lower:
            continue
        patterns.append(re.compile(_alias_pattern(alias), re.IGNORECASE))
    for alias in skill.case_sensitive_aliases:
        patterns.append(re.compile(_alias_pattern(alias)))
    return tuple(patterns)


def find_skill_in_text(key: str, text: str, *, include_short: bool = False) -> re.Match[str] | None:
    """Return the first match of any alias of ``key`` in ``text``."""
    best: re.Match[str] | None = None
    for pattern in _patterns_for(key, include_short):
        match = pattern.search(text)
        if match and (best is None or match.start() < best.start()):
            best = match
    return best


def extract_known_skills(text: str, *, include_short: bool = False) -> list[str]:
    """Return sorted canonical keys of every taxonomy skill mentioned in ``text``."""
    found = {key for key in SKILLS if find_skill_in_text(key, text, include_short=include_short)}
    return sorted(found)


def dedupe_skills(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if not value or not value.strip():
            continue
        key = normalize_skill(value)
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result
