-- Office 365 Scanner Database Schema (SQLite)
-- Version: 1.0.0
-- Description: Initial database schema for Office 365 Scanner

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_principal_name TEXT UNIQUE NOT NULL,
    display_name TEXT,
    mail TEXT,
    job_title TEXT,
    department TEXT,
    office_location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME
);

-- Files Table
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size INTEGER,
    web_url TEXT,
    created_datetime DATETIME,
    last_modified_datetime DATETIME,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME
);

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT,
    body_content TEXT,
    start_datetime DATETIME,
    end_datetime DATETIME,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    is_cancelled INTEGER DEFAULT 0,
    organizer_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME
);

-- Event Attendees Table
CREATE TABLE IF NOT EXISTS event_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    response_status TEXT
);

-- Scan History Table
CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    status TEXT NOT NULL,
    items_scanned INTEGER DEFAULT 0,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_datetime ON calendar_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);
