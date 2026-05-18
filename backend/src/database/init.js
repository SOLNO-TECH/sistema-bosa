const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'bosa.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('superadmin', 'administrator', 'manager')),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT,
      start_time  TEXT    NOT NULL, -- ISO 8601
      end_time    TEXT    NOT NULL, -- ISO 8601
      created_by  INTEGER NOT NULL,
      attendees   TEXT,              -- JSON array of user IDs
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT,
      status      TEXT    NOT NULL DEFAULT 'open',
      priority    TEXT    NOT NULL DEFAULT 'medium',
      category    TEXT,
      assigned_to INTEGER,
      created_by  INTEGER NOT NULL,
      due_date    TEXT,              -- ISO 8601
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      action      TEXT    NOT NULL,  -- 'status_change', 'assignment', 'comment', etc.
      details     TEXT,              -- JSON or text
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      filename    TEXT    NOT NULL,
      mimetype    TEXT    NOT NULL,
      path        TEXT    NOT NULL,
      uploaded_by INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS avisos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'general', -- general, important, emergency
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_by  INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meeting_minutes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lugar           TEXT    NOT NULL DEFAULT '',
      fecha           TEXT    NOT NULL,
      hora_inicio     TEXT    NOT NULL DEFAULT '',
      hora_cierre     TEXT    NOT NULL DEFAULT '',
      tema            TEXT    NOT NULL DEFAULT '',
      attendees_json  TEXT    NOT NULL DEFAULT '[]',
      topics_json     TEXT    NOT NULL DEFAULT '[]',
      created_by      INTEGER NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_meeting_minutes_fecha ON meeting_minutes(fecha DESC);

    -- Notificaciones internas del sistema
    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL, -- destinatario
      type        TEXT    NOT NULL DEFAULT 'system', -- ticket | comment | aviso | meeting | forum | system
      title       TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      module      TEXT,             -- 'tickets' | 'calendar' | 'avisos' | 'foro' | 'notifications'
      related_id  INTEGER,          -- id del ticket/aviso/reunion relacionado
      is_read     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      endpoint    TEXT    NOT NULL UNIQUE,
      p256dh      TEXT    NOT NULL,
      auth        TEXT    NOT NULL,
      user_agent  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

    CREATE TRIGGER IF NOT EXISTS update_users_timestamp
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS workgroups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workgroup_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workgroup_id INTEGER NOT NULL,
      user_id      INTEGER NOT NULL,
      content      TEXT,
      file_url     TEXT,
      file_name    TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workgroup_id) REFERENCES workgroups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migración de columnas nuevas si no existen
  const columnsToAdd = ['apellido', 'telefono', 'departamento', 'puesto'];
  for (const col of columnsToAdd) {
    try {
      db.prepare(`ALTER TABLE users ADD COLUMN ${col} TEXT DEFAULT ''`).run();
    } catch (err) {
      // La columna ya existe
    }
  }

  // Permitir rol manager (gerente de departamento): SQLite no puede alterar CHECK
  try {
    const meta = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
    const sql = meta?.sql || '';
    if (sql.includes("CHECK(role IN ('superadmin', 'administrator'))") && !sql.includes('manager')) {
      db.pragma('foreign_keys = OFF');
      db.exec('BEGIN IMMEDIATE;');
      db.exec('ALTER TABLE users RENAME TO users_old;');
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('superadmin', 'administrator', 'manager')),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          apellido TEXT DEFAULT '',
          telefono TEXT DEFAULT '',
          departamento TEXT DEFAULT '',
          puesto TEXT DEFAULT ''
        );
      `);
      db.exec(`
        INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at, apellido, telefono, departamento, puesto)
        SELECT id, name, email, password, role, is_active, created_at, updated_at,
          COALESCE(apellido, ''), COALESCE(telefono, ''), COALESCE(departamento, ''), COALESCE(puesto, '')
        FROM users_old;
      `);
      db.exec('DROP TABLE users_old;');
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        BEGIN
          UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
      `);
      db.exec(
        `INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('users', (SELECT IFNULL(MAX(id), 0) FROM users));`
      );
      db.exec('COMMIT;');
      db.pragma('foreign_keys = ON');
      console.log('[DB] users: rol manager habilitado (migración CHECK)');
    }
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}
    try {
      db.pragma('foreign_keys = ON');
    } catch (_) {}
    console.warn('[DB] migración role manager:', err.message);
  }

  try {
    db.prepare(`ALTER TABLE tickets ADD COLUMN due_date TEXT`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE workgroups ADD COLUMN access_type TEXT DEFAULT 'all'`).run();
    db.prepare(`ALTER TABLE workgroups ADD COLUMN access_list TEXT DEFAULT '[]'`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE workgroups ADD COLUMN extra_allowed_user_ids TEXT DEFAULT '[]'`).run();
  } catch (err) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS forum_join_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workgroup_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'rejected')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workgroup_id) REFERENCES workgroups(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(workgroup_id, user_id)
      );
    `);
  } catch (err) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_tasks (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id     INTEGER NOT NULL,
        title         TEXT    NOT NULL,
        description   TEXT,
        assigned_to   INTEGER NOT NULL,
        created_by    INTEGER NOT NULL,
        start_date    TEXT    NOT NULL,
        end_date      TEXT    NOT NULL,
        status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by)   REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_tasks_ticket ON ticket_tasks(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_tasks_assignee ON ticket_tasks(assigned_to);
    `);
  } catch (err) {
    console.warn('[DB] ticket_tasks migration:', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        endpoint    TEXT    NOT NULL UNIQUE,
        p256dh      TEXT    NOT NULL,
        auth        TEXT    NOT NULL,
        user_agent  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    `);
  } catch (err) {
    console.warn('[DB] push_subscriptions migration:', err.message);
  }

  seedDefaultUsers(db);
}

function seedDefaultUsers(db) {
  const defaults = [
    {
      name: 'Super',
      apellido: 'Administrador',
      email: 'superadmin@bosa.mx',
      telefono: '',
      departamento: 'Sistemas',
      puesto: 'Director de TI',
      password: 'Bosa@SuperAdmin2024!',
      role: 'superadmin',
    },
    {
      name: 'Administrador',
      apellido: 'General',
      email: 'admin@bosa.mx',
      telefono: '',
      departamento: 'Operaciones',
      puesto: 'Gerente General',
      password: 'Bosa@Admin2024!',
      role: 'administrator',
    },
  ];

  const upsert = db.prepare(`
    INSERT INTO users (name, apellido, email, telefono, departamento, puesto, password, role)
    VALUES (@name, @apellido, @email, @telefono, @departamento, @puesto, @password, @role)
    ON CONFLICT(email) DO NOTHING
  `);

  for (const user of defaults) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email);
    if (!existing) {
      const hashed = bcrypt.hashSync(user.password, 12);
      upsert.run({ ...user, password: hashed });
      console.log(`[SEED] Usuario creado: ${user.email} (${user.role})`);
    }
  }
}

module.exports = { getDb, initDatabase };
