import { z } from "zod";

/**
 * Domain contracts shared by the parser, match engine, renderers and API.
 * Every AI provider must return data that validates against these schemas,
 * so the rest of the system never depends on which model produced it.
 */

export const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""), // "Present" for current roles
  bullets: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string().default(""),
  field: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  details: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  technologies: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
  link: z.string().default(""),
});

export const ProfileSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  links: z.array(z.string()).default([]),
  headline: z.string().default(""),
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;

export const ExperienceLevelSchema = z.enum([
  "intern",
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
  "unspecified",
]);

export const JobSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().default(""),
  experienceLevel: ExperienceLevelSchema.default("unspecified"),
  minYearsExperience: z.number().nullable().default(null),
  skills: z.array(z.string()).default([]), // hard skills / technologies
  requirements: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]), // other ATS terms (methodologies, domains)
  // Interchangeable skills ("FastAPI or Django"): having any one satisfies the group.
  alternatives: z.array(z.array(z.string())).default([]),
});
export type Job = z.infer<typeof JobSchema>;

/** One rewritten bullet, linked back to its source so it can be audited. */
export const BulletRewriteSchema = z.object({
  experienceIndex: z.number().int(),
  bulletIndex: z.number().int(),
  original: z.string(),
  rewritten: z.string(),
});

/** What the AI is allowed to change. Everything else is copied from the profile. */
export const TailoringSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  rewrites: z.array(BulletRewriteSchema),
});
export type Tailoring = z.infer<typeof TailoringSchema>;

export const CoverLetterSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  closing: z.string(),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export type AtsScore = {
  overall: number;
  skills: number;
  experience: number;
  keywords: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
};

export const APPLICATION_STATUSES = [
  "generated",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
