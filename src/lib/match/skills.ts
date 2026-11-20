/**
 * Skill vocabulary + normalization. Matching is done on canonical names so
 * "k8s", "Kubernetes" and "kubernetes" are the same skill, and "Java" never
 * matches inside "JavaScript".
 */

// canonical name -> aliases (lowercase). The canonical name itself is always an alias.
const VOCAB: Record<string, string[]> = {
  // Languages
  Python: ["python3"],
  JavaScript: ["js", "ecmascript", "es6"],
  TypeScript: ["ts"],
  Java: [],
  "C#": ["csharp", "c sharp"],
  "C++": ["cpp"],
  C: [],
  Go: ["golang"],
  Rust: [],
  Ruby: [],
  PHP: [],
  Kotlin: [],
  Swift: [],
  Scala: [],
  R: [],
  SQL: [],
  Bash: ["shell scripting"],
  Dart: [],
  Elixir: [],
  // Frontend
  React: ["react.js", "reactjs"],
  "Next.js": ["nextjs", "next js"],
  "Vue.js": ["vuejs"],
  Angular: ["angularjs"],
  Svelte: [],
  HTML: ["html5"],
  CSS: ["css3"],
  "Tailwind CSS": ["tailwind", "tailwindcss"],
  Redux: [],
  "React Native": [],
  Flutter: [],
  // Backend
  "Node.js": ["node", "nodejs", "node js"],
  Express: ["express.js", "expressjs"],
  NestJS: ["nest.js", "nest"],
  Django: [],
  Flask: [],
  FastAPI: [],
  "Spring Boot": ["spring", "springboot"],
  Rails: ["ruby on rails", "ror"],
  ".NET": ["dotnet", ".net core"],
  GraphQL: [],
  "REST APIs": ["rest", "restful", "rest api", "restful apis", "restful api"],
  gRPC: [],
  Microservices: ["microservice", "micro-services"],
  Kafka: ["apache kafka"],
  RabbitMQ: [],
  // Data stores
  PostgreSQL: ["postgres", "psql"],
  MySQL: [],
  MongoDB: ["mongo"],
  Redis: [],
  Elasticsearch: ["elastic search"],
  DynamoDB: [],
  Cassandra: [],
  Snowflake: [],
  BigQuery: [],
  SQLite: [],
  // Cloud / infra
  AWS: ["amazon web services"],
  GCP: ["google cloud", "google cloud platform"],
  Azure: ["microsoft azure"],
  Docker: [],
  Kubernetes: ["k8s"],
  Terraform: [],
  Ansible: [],
  Helm: [],
  Serverless: [],
  Linux: ["unix"],
  Nginx: [],
  "CI/CD": ["ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  "GitHub Actions": [],
  Jenkins: [],
  GitLab: ["gitlab ci"],
  Git: [],
  Prometheus: [],
  Grafana: [],
  Datadog: [],
  "Infrastructure as Code": ["iac"],
  // Data / ML
  "Machine Learning": ["ml"],
  "Deep Learning": [],
  PyTorch: [],
  TensorFlow: [],
  "scikit-learn": ["sklearn", "scikit learn"],
  Pandas: [],
  NumPy: [],
  Spark: ["apache spark"],
  Airflow: ["apache airflow"],
  dbt: [],
  ETL: [],
  NLP: ["natural language processing"],
  "Computer Vision": [],
  LLMs: ["llm", "large language models"],
  "Data Analysis": ["data analytics"],
  Tableau: [],
  "Power BI": ["powerbi"],
  Excel: ["microsoft excel"],
  Statistics: ["statistical analysis"],
  // Practices
  Agile: [],
  TDD: ["test-driven development", "test driven development"],
  "Unit Testing": ["unit tests"],
  "System Design": [],
  Security: [],
  OAuth: ["oauth2"],
  Observability: [],
  "Performance Optimization": ["performance tuning"],
  Accessibility: ["a11y", "wcag"],
  // Product / business
  "Product Management": [],
  "Project Management": ["project manager"],
  "Stakeholder Management": ["stakeholder communication"],
  Leadership: [],
  Communication: ["communication skills"],
  Figma: [],
  "UX Design": ["ux", "user experience"],
  "UI Design": ["user interface design"],
  SEO: [],
  Salesforce: [],
  Jira: [],
};

/**
 * Terms that are evidence of a skill without being a synonym for it
 * ("Scrum" implies Agile, "EKS" implies Kubernetes). They count when matching
 * but are never rewritten or used to rename a user's own skills.
 */
const IMPLIES: Record<string, string[]> = {
  Bash: ["shell"],
  Docker: ["containers", "containerization"],
  Kubernetes: ["eks", "gke", "aks"],
  Serverless: ["aws lambda", "lambda"],
  Git: ["github", "version control"],
  ETL: ["elt", "data pipelines", "data pipeline"],
  LLMs: ["generative ai", "genai"],
  "Data Analysis": ["analytics"],
  Agile: ["scrum", "kanban"],
  "Unit Testing": ["jest", "pytest", "junit"],
  "System Design": ["distributed systems", "scalable systems"],
  Security: ["application security", "appsec", "owasp"],
  OAuth: ["openid connect", "oidc"],
  Observability: ["monitoring", "logging"],
  Leadership: ["team leadership", "people management", "mentoring", "mentorship"],
  "Stakeholder Management": ["stakeholders"],
  "Project Management": ["pmp"],
  "Product Management": ["product manager"],
  Elasticsearch: ["opensearch"],
  Spark: ["pyspark"],
  ".NET": ["asp.net"],
};

type Entry = { canonical: string; pattern: RegExp };

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Single-letter / ambiguous canonical names that only match in explicit skill lists.
const AMBIGUOUS = new Set(["c", "r", "go", "rest", "node", "nest", "shell", "spring", "lambda", "ml", "ux", "ts", "js", "analytics", "monitoring", "logging", "containers", "stakeholders", "express", "mongo"]);

const ENTRIES: Entry[] = [];
const LOOKUP = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(VOCAB)) {
  const synonyms = [canonical.toLowerCase(), ...aliases];
  for (const alias of synonyms) LOOKUP.set(alias, canonical);
  for (const alias of [...synonyms, ...(IMPLIES[canonical] ?? [])]) {
    if (AMBIGUOUS.has(alias)) continue;
    // Custom boundaries: allow skills that end in symbols (C#, C++, .NET, CI/CD).
    ENTRIES.push({
      canonical,
      pattern: new RegExp(`(?<![\\w.#+/-])${escape(alias)}(?![\\w#+]|\\.\\w)`, "i"),
    });
  }
}

/** Canonical name for a skill string; unknown skills keep their trimmed form. */
export function canonicalSkill(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return LOOKUP.get(key) ?? raw.trim();
}

export function skillKey(raw: string): string {
  return canonicalSkill(raw).toLowerCase();
}

/** Find known skills mentioned anywhere in free text. */
export function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const { canonical, pattern } of ENTRIES) {
    if (pattern.test(text)) found.add(canonical);
  }
  return [...found];
}

/** Does this text mention the given skill (by canonical name or any alias)? */
export function textMentionsSkill(text: string, skill: string): boolean {
  const canonical = canonicalSkill(skill);
  const aliases = VOCAB[canonical];
  const terms = aliases
    ? [canonical.toLowerCase(), ...aliases, ...(IMPLIES[canonical] ?? [])].filter((t) => !AMBIGUOUS.has(t))
    : [skill.toLowerCase()];
  return terms.some((t) =>
    new RegExp(`(?<![\\w.#+/-])${escape(t)}(?![\\w#+]|\\.\\w)`, "i").test(text),
  );
}

/**
 * Rewrite unambiguous aliases of a skill to its canonical spelling
 * ("postgres" → "PostgreSQL", "k8s" → "Kubernetes"). Ambiguous aliases
 * (e.g. "go", "node") are left untouched.
 */
export function replaceAliases(text: string, skill: string): string {
  const canonical = canonicalSkill(skill);
  const aliases = (VOCAB[canonical] ?? []).filter((a) => !AMBIGUOUS.has(a));
  let out = text;
  for (const alias of aliases.sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`(?<![\\w.#+/-])${escape(alias)}(?![\\w#+]|\\.\\w)`, "gi"),
      canonical,
    );
  }
  return out;
}

export function dedupeSkills(skills: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of skills) {
    if (!s.trim()) continue;
    const c = canonicalSkill(s);
    if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()];
}

/** Domain / practice phrases ATS systems commonly scan for (non-tool keywords). */
const DOMAIN_PHRASES = [
  "payments", "fintech", "e-commerce", "ecommerce", "healthcare", "saas", "b2b", "b2c", "marketplace", "banking",
  "insurance", "logistics", "edtech", "adtech", "cybersecurity", "real-time", "high availability", "scalability",
  "reliability", "fault tolerance", "low latency", "distributed systems", "event-driven", "data modeling",
  "api design", "system architecture", "code review", "code reviews", "pair programming", "on-call", "incident response",
  "root cause analysis", "technical debt", "cross-functional", "stakeholder", "ownership", "end to end", "end-to-end",
  "roadmap", "mentoring", "mentorship", "hiring", "onboarding", "a/b testing", "experimentation", "metrics", "kpis",
  "customer-facing", "user research", "product strategy", "go-to-market", "compliance", "gdpr", "hipaa", "pci",
  "soc 2", "accessibility", "performance optimization", "cost optimization", "automation", "documentation",
  "technical leadership", "data-driven", "startup", "fast-paced", "remote", "agile", "scrum",
];

const GENERIC = new Set(
  "a an and are as at be by for from has have in is it its of on or our the to was we were will with you your their they this that who what which while within across about into over more than strong excellent ability able experience experienced years year work working team teams including etc using use used new must should plus preferred required requirements responsibilities role job candidate ideal looking join company skills knowledge understanding proficiency proficient familiarity familiar good great highly well based other such also all any can may one two three both each hands-on hands production building build built design designing develop developing end code support supporting help helping make ensure create drive own owning deliver delivering collaborate collaborating participate participating closely bonus nice".split(
    " ",
  ),
);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Non-skill ATS keywords from a job description: known domain/practice
 * phrases, plus two-word phrases that recur in the posting. Single generic
 * words ("design", "code") are never keywords on their own.
 */
export function extractKeywordsFromText(text: string, limit = 15): string[] {
  const lower = text.toLowerCase();
  const found = new Map<string, number>();
  for (const phrase of DOMAIN_PHRASES) {
    const n = (lower.match(new RegExp(`(?<![\\w-])${escapeRe(phrase)}(?![\\w-])`, "g")) ?? []).length;
    if (n) found.set(phrase, n + 1); // boost curated phrases
  }

  const skillTerms = new Set(extractSkillsFromText(text).map((s) => s.toLowerCase()));
  for (const line of lower.split("\n")) {
    const words = line
      .replace(/[^a-z0-9+#./\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[.\-/]+|[.\-/]+$/g, ""))
      .filter(Boolean);
    for (let i = 0; i + 1 < words.length; i++) {
      const [a, b] = [words[i], words[i + 1]];
      if (GENERIC.has(a) || GENERIC.has(b) || a.length < 3 || b.length < 3 || /\d/.test(a + b)) continue;
      if (LOOKUP.has(a) || LOOKUP.has(b) || skillTerms.has(a) || skillTerms.has(b)) continue;
      const bigram = `${a} ${b}`;
      found.set(bigram, (found.get(bigram) ?? 0) + 1);
    }
  }

  return [...found.entries()]
    .filter(([term, n]) => n >= 2 && !LOOKUP.has(term))
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    // Prefer the longer phrase when one contains another ("code review" vs "code reviews").
    .filter((term, _i, arr) => !arr.some((o) => o !== term && o.includes(term) && o.length > term.length))
    .slice(0, limit);
}
