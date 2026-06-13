-- Add unit column to leave_types (days | hours)
ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'days'
CHECK (unit IN ('days', 'hours'));

UPDATE leave_types SET unit = 'days' WHERE unit IS NULL;
