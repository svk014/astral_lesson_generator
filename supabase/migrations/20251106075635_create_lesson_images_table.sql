-- Create lesson_images table for storing image-to-short-hash mappings
CREATE TABLE lesson_images (
  id bigserial primary key,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  short_hash VARCHAR(12) NOT NULL UNIQUE,
  storage_path VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_lesson_images_lesson_id ON lesson_images(lesson_id);
CREATE INDEX idx_lesson_images_short_hash ON lesson_images(short_hash);
CREATE INDEX idx_lesson_images_created_at ON lesson_images(created_at);
