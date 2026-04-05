-- Frame.io Upload Dashboard - Initial Schema
-- Creates all tables with Row Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create upload status enum
CREATE TYPE upload_status AS ENUM ('pending', 'uploading', 'completed', 'failed');

-- Admins table (links to Supabase Auth users)
CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frame.io folders table (synced from Frame.io API)
CREATE TABLE frameio_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frameio_asset_id TEXT NOT NULL UNIQUE,
  frameio_project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  custom_label TEXT,
  admin_note TEXT,
  is_enabled BOOLEAN DEFAULT false,
  path_breadcrumb TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upload events table (logs all upload attempts)
CREATE TABLE upload_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frameio_asset_id TEXT,
  folder_id UUID NOT NULL REFERENCES frameio_folders(id) ON DELETE CASCADE,
  uploader_name TEXT,
  uploader_email TEXT,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  status upload_status DEFAULT 'pending',
  error_message TEXT,
  ip_address_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Settings table (stores Frame.io token and other config)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_frameio_folders_enabled ON frameio_folders(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_frameio_folders_project ON frameio_folders(frameio_project_id);
CREATE INDEX idx_upload_events_folder ON upload_events(folder_id);
CREATE INDEX idx_upload_events_status ON upload_events(status);
CREATE INDEX idx_upload_events_created ON upload_events(created_at DESC);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE frameio_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Admins table: Only authenticated admins can read their own row
CREATE POLICY "Admins can read own record"
  ON admins FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Frame.io folders: Anyone can read enabled folders, only admins can modify
CREATE POLICY "Anyone can read enabled folders"
  ON frameio_folders FOR SELECT
  TO anon, authenticated
  USING (is_enabled = true);

CREATE POLICY "Admins can read all folders"
  ON frameio_folders FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can insert folders"
  ON frameio_folders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can update folders"
  ON frameio_folders FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can delete folders"
  ON frameio_folders FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

-- Upload events: Anyone can insert, only admins can read/update/delete
CREATE POLICY "Anyone can insert upload events"
  ON upload_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all upload events"
  ON upload_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can update upload events"
  ON upload_events FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can delete upload events"
  ON upload_events FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

-- Settings: Only admins can access
CREATE POLICY "Admins can read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can insert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for settings table
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
