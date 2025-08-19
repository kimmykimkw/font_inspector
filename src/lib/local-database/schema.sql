-- Font Inspector Local Database Schema
-- This schema mirrors the Firebase Firestore structure for inspections and projects

-- Inspections table
-- Mirrors the Inspection interface from src/lib/models/inspection.ts
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  timestamp INTEGER NOT NULL, -- Unix timestamp in milliseconds
  downloaded_fonts TEXT NOT NULL DEFAULT '[]', -- JSON string of DownloadedFont[]
  font_face_declarations TEXT NOT NULL DEFAULT '[]', -- JSON string of FontFaceDeclaration[]
  active_fonts TEXT NOT NULL DEFAULT '[]', -- JSON string of ActiveFont[]
  project_id TEXT, -- Optional reference to projects table
  user_id TEXT NOT NULL, -- Firebase user ID for data isolation
  created_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
  updated_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
  status TEXT DEFAULT 'completed', -- 'completed' | 'failed'
  error TEXT, -- Error message if status is 'failed'
  
  -- Screenshot data (optional)
  screenshot_original TEXT, -- Local file path to original screenshot
  screenshot_annotated TEXT, -- Local file path to annotated screenshot
  screenshot_captured_at INTEGER, -- Unix timestamp in milliseconds
  screenshot_dimensions TEXT, -- JSON string: {width: number, height: number}
  screenshot_annotation_count INTEGER -- Number of font annotations added
);

-- Projects table
-- Mirrors the Project interface from src/lib/models/project.ts
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  inspection_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of inspection IDs
  user_id TEXT NOT NULL, -- Firebase user ID for data isolation
  created_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
  updated_at INTEGER NOT NULL -- Unix timestamp in milliseconds
);

-- Indexes for performance optimization
-- These mirror the Firebase composite indexes from firestore.indexes.json

-- Inspections indexes
CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user_created ON inspections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_timestamp ON inspections(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_project_id ON inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- Additional utility indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inspections_url ON inspections(url);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_updated_at ON inspections(updated_at DESC);
