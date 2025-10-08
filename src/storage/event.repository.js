const db = require('./database.service');
const logger = require('../utils/logger');

class EventRepository {
  /**
   * Upsert a calendar event (insert or update if exists)
   * @param {Object} eventData - Event data from Microsoft Graph
   * @param {string} userId - User ID who owns the event
   * @returns {Promise<Object>} Inserted/updated event
   */
  async upsertEvent(eventData, userId) {
    // Use transaction to ensure atomicity of event and attendee operations
    return await db.transaction(async (client) => {
      return await this.upsertEventInTransaction(eventData, userId, client);
    });
  }

  /**
   * Bulk upsert events for a user
   * @param {Array<Object>} events - Array of event data
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of events upserted
   */
  async bulkUpsertEvents(events, userId) {
    if (!events || events.length === 0) return 0;

    // Use transaction for consistency
    return await db.transaction(async (client) => {
      for (const event of events) {
        await this.upsertEventInTransaction(event, userId, client);
      }
      return events.length;
    });
  }

  /**
   * Upsert event within a transaction
   * @param {Object} eventData - Event data
   * @param {string} userId - User ID
   * @param {Object} client - Database client
   * @returns {Promise<Object>} Inserted/updated event
   */
  async upsertEventInTransaction(eventData, userId, client) {
    const query = `
      INSERT INTO calendar_events (
        id, user_id, subject, body_content,
        start_datetime, end_datetime, location,
        is_all_day, is_cancelled, organizer_email,
        last_scanned_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id)
      DO UPDATE SET
        subject = EXCLUDED.subject,
        body_content = EXCLUDED.body_content,
        start_datetime = EXCLUDED.start_datetime,
        end_datetime = EXCLUDED.end_datetime,
        location = EXCLUDED.location,
        is_all_day = EXCLUDED.is_all_day,
        is_cancelled = EXCLUDED.is_cancelled,
        organizer_email = EXCLUDED.organizer_email,
        last_scanned_at = EXCLUDED.last_scanned_at,
        updated_at = EXCLUDED.updated_at
    `;

    const timestamp = new Date().toISOString();
    const values = [
      eventData.id,
      userId,
      eventData.subject,
      eventData.body?.content || null,
      eventData.start?.dateTime ? new Date(eventData.start.dateTime).toISOString() : null,
      eventData.end?.dateTime ? new Date(eventData.end.dateTime).toISOString() : null,
      eventData.location?.displayName || null,
      eventData.isAllDay || false,
      eventData.isCancelled || false,
      eventData.organizer?.emailAddress?.address || null,
      timestamp,
      timestamp
    ];

    await client.query(query, values);
    const eventId = eventData.id;

    // Handle attendees within the same transaction
    if (eventData.attendees && eventData.attendees.length > 0) {
      await this.upsertAttendeesInTransaction(eventId, eventData.attendees, client);
    }

    return { id: eventId };
  }

  /**
   * Upsert attendees within a transaction
   * @param {string} eventId - Event ID
   * @param {Array<Object>} attendees - Array of attendees
   * @param {Object} client - Database client
   * @returns {Promise<void>}
   */
  async upsertAttendeesInTransaction(eventId, attendees, client) {
    // First, delete existing attendees
    await client.query('DELETE FROM event_attendees WHERE event_id = $1', [eventId]);

    // Then insert new attendees
    for (const attendee of attendees) {
      const query = `
        INSERT INTO event_attendees (event_id, email, name, response_status)
        VALUES ($1, $2, $3, $4)
      `;

      const values = [
        eventId,
        attendee.emailAddress?.address || null,
        attendee.emailAddress?.name || null,
        attendee.status?.response || null
      ];

      await client.query(query, values);
    }
  }

  /**
   * Get all events
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of events
   */
  async getAllEvents(options = {}) {
    const { limit, offset } = options;
    let query = 'SELECT * FROM calendar_events ORDER BY start_datetime DESC';
    const params = [];

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get events by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of events
   */
  async getEventsByUserId(userId) {
    const query = 'SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_datetime DESC';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get event by ID with attendees
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Event object with attendees or null
   */
  async getEventById(eventId) {
    const eventQuery = 'SELECT * FROM calendar_events WHERE id = $1';
    const eventResult = await db.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return null;
    }

    const event = eventResult.rows[0];

    // Get attendees
    const attendeesQuery = 'SELECT * FROM event_attendees WHERE event_id = $1';
    const attendeesResult = await db.query(attendeesQuery, [eventId]);
    event.attendees = attendeesResult.rows;

    return event;
  }

  /**
   * Get events count
   * @returns {Promise<number>} Total number of events
   */
  async getEventsCount() {
    const query = 'SELECT COUNT(*) as count FROM calendar_events';
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get events count by user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of events for user
   */
  async getEventsCountByUser(userId) {
    const query = 'SELECT COUNT(*) as count FROM calendar_events WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteEvent(eventId) {
    const query = 'DELETE FROM calendar_events WHERE id = $1';
    const result = await db.query(query, [eventId]);
    return result.rowCount > 0;
  }

  /**
   * Get upcoming events
   * @param {number} days - Number of days ahead
   * @returns {Promise<Array>} Array of upcoming events
   */
  async getUpcomingEvents(days = 30) {
    const now = new Date();
    const end = new Date(now.getTime() + parseInt(days, 10) * 24 * 60 * 60 * 1000);
    const query = `
      SELECT * FROM calendar_events
      WHERE start_datetime >= $1
      AND start_datetime <= $2
      ORDER BY start_datetime
    `;
    const result = await db.query(query, [now.toISOString(), end.toISOString()]);
    return result.rows;
  }
}

module.exports = new EventRepository();
