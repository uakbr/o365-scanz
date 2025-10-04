-- Office 365 Scanner Database Schema
-- Version: 1.0.0
-- Description: Initial database schema for Office 365 Scanner

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    user_principal_name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    mail VARCHAR(255),
    job_title VARCHAR(255),
    department VARCHAR(255),
    office_location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMP
);

-- Files Table
CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    size BIGINT,
    web_url TEXT,
    created_datetime TIMESTAMP,
    last_modified_datetime TIMESTAMP,
    mime_type VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMP
);

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(500),
    body_content TEXT,
    start_datetime TIMESTAMP,
    end_datetime TIMESTAMP,
    location VARCHAR(500),
    is_all_day BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    organizer_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMP
);

-- Event Attendees Table
CREATE TABLE IF NOT EXISTS event_attendees (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) REFERENCES calendar_events(id) ON DELETE CASCADE,
    email VARCHAR(255),
    name VARCHAR(255),
    response_status VARCHAR(50)
);

-- Scan History Table
CREATE TABLE IF NOT EXISTS scan_history (
    id SERIAL PRIMARY KEY,
    scan_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    items_scanned INTEGER DEFAULT 0,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_datetime ON calendar_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);

-- Comments
COMMENT ON TABLE users IS 'Stores Office 365 user information';
COMMENT ON TABLE files IS 'Stores OneDrive file metadata';
COMMENT ON TABLE calendar_events IS 'Stores calendar events';
COMMENT ON TABLE event_attendees IS 'Stores event attendee information';
COMMENT ON TABLE scan_history IS 'Tracks scan operations history';
