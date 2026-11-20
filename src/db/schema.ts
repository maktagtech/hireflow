import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import type {
  AtsScore,
  CoverLetter,
  Job,
  Profile,
  Tailoring,
  ApplicationStatus,
} from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  // Bumped on password change/reset; sessions carrying an older version are rejected.
  sessionVersion: integer("session_version").notNull().default(0),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One master profile per user. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  profileData: jsonb("profile_data").$type<Profile>().notNull(),
  sourceFileKey: text("source_file_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A job the user is applying to. `status` drives the interview-rate metric. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobTitle: text("job_title").notNull().default(""),
    company: text("company").notNull().default(""),
    jobDescription: text("job_description").notNull(),
    url: text("url"),
    parsed: jsonb("parsed").$type<Job>().notNull(),
    status: text("status").$type<ApplicationStatus>().notNull().default("generated"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_user_idx").on(t.userId, t.createdAt)],
);

export const generatedResumes = pgTable(
  "generated_resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    resumeVersion: integer("resume_version").notNull().default(1),
    pdfUrl: text("pdf_url").notNull(),
    docxUrl: text("docx_url").notNull(),
    coverLetterPdfUrl: text("cover_letter_pdf_url").notNull(),
    coverLetterDocxUrl: text("cover_letter_docx_url").notNull(),
    atsScore: jsonb("ats_score").$type<AtsScore>().notNull(),
    baselineScore: jsonb("baseline_score").$type<AtsScore>().notNull(),
    tailoring: jsonb("tailoring").$type<Tailoring>().notNull(),
    tailoredProfile: jsonb("tailored_profile").$type<Profile>().notNull(),
    coverLetter: jsonb("cover_letter").$type<CoverLetter>().notNull(),
    aiProvider: text("ai_provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("generated_job_idx").on(t.jobId)],
);

/** Single-use password reset tokens. Only a SHA-256 hash of the token is stored. */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Beta invites. With BETA_INVITE_ONLY=true, signing up requires a valid code. */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  // When set, only this email address can redeem the invite.
  email: text("email"),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  note: text("note").notNull().default(""),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
