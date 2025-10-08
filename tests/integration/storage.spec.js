const fs = require('fs');
const path = require('path');

// Configure environment before loading application modules
const tmpDir = path.join(__dirname, '..', 'tmp');
const dbPath = path.join(tmpDir, 'test.sqlite');

process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = dbPath;
process.env.AZURE_CLIENT_ID = 'test-client';
process.env.AZURE_CLIENT_SECRET = 'test-secret';
process.env.AZURE_TENANT_ID = 'test-tenant';
process.env.SESSION_SECRET = 'test-session-secret';

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const { runMigrations } = require('../../database/migrate');
const db = require('../../src/storage/database.service');
const userRepository = require('../../src/storage/user.repository');
const eventRepository = require('../../src/storage/event.repository');

beforeAll(async () => {
  await runMigrations();
});

afterEach(async () => {
  await db.query('DELETE FROM event_attendees');
  await db.query('DELETE FROM calendar_events');
  await db.query('DELETE FROM files');
  await db.query('DELETE FROM users');
});

afterAll(async () => {
  await db.close();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

describe('SQLite repository compatibility', () => {
  it('upserts a user without relying on PostgreSQL-specific functions', async () => {
    const user = {
      id: 'user-1',
      userPrincipalName: 'user1@example.com',
      displayName: 'User One',
      mail: 'user1@example.com',
      jobTitle: 'Engineer',
      department: 'R&D',
      officeLocation: 'HQ'
    };

    await expect(userRepository.upsertUser(user)).resolves.toBe(true);

    const stored = await userRepository.getUserById(user.id);

    expect(stored).toBeTruthy();
    expect(stored.user_principal_name).toBe(user.userPrincipalName);
    expect(stored.display_name).toBe(user.displayName);
    expect(stored.department).toBe(user.department);
  });

  it('rolls back event inserts when attendee persistence fails', async () => {
    const user = {
      id: 'user-2',
      userPrincipalName: 'user2@example.com',
      displayName: 'User Two',
      mail: 'user2@example.com',
      jobTitle: 'Manager',
      department: 'Ops',
      officeLocation: 'Remote'
    };

    await userRepository.upsertUser(user);

    const event = {
      id: 'event-1',
      subject: 'Critical Meeting',
      body: { content: 'Strategy session' },
      start: { dateTime: new Date().toISOString() },
      end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      location: { displayName: 'Conference Room' },
      isAllDay: false,
      isCancelled: false,
      organizer: { emailAddress: { address: 'organizer@example.com' } },
      attendees: [
        {
          emailAddress: { address: 'attendee@example.com', name: 'Attendee' },
          status: { response: 'accepted' }
        }
      ]
    };

    const attendeeSpy = jest
      .spyOn(eventRepository, 'upsertAttendeesInTransaction')
      .mockImplementation(async () => {
        throw new Error('intentional failure');
      });

    await expect(eventRepository.upsertEvent(event, user.id)).rejects.toThrow('intentional failure');

    attendeeSpy.mockRestore();

    const storedEvent = await eventRepository.getEventById(event.id);
    expect(storedEvent).toBeNull();
  });
});
