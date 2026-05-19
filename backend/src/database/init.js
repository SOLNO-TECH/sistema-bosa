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
    db.pragma('foreign_keys = OFF');
    repairDatabaseState(db);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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

  migrateUsersManagerRoleOnce(db);

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

  repairDatabaseState(db);
  seedDefaultUsers(db);
}

/** Una sola vez: rol manager en users (evita re-ejecutar al reiniciar). */
function migrateUsersManagerRoleOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'users_manager_role_v1'").get();
    if (done) return;

    if (getTablesReferencing(db, 'users_old').length > 0) {
      repairBrokenUserForeignKeys(db);
      const usersSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get()?.sql || '';
      if (usersSql.includes('manager')) {
        db.prepare("INSERT OR IGNORE INTO schema_migrations (name) VALUES ('users_manager_role_v1')").run();
        return;
      }
    }

    const meta = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (!meta?.sql) return;

    const sql = meta.sql;
    if (sql.includes('manager')) {
      db.prepare("INSERT OR IGNORE INTO schema_migrations (name) VALUES ('users_manager_role_v1')").run();
      return;
    }
    if (!sql.includes("CHECK(role IN ('superadmin', 'administrator'))")) return;

    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users_old'").get()) {
      db.exec('DROP TABLE IF EXISTS users_old');
    }

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
    repairBrokenUserForeignKeys(db);
    db.exec('DROP TABLE users_old;');
    db.exec(
      `INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('users', (SELECT IFNULL(MAX(id), 0) FROM users));`
    );
    db.prepare("INSERT INTO schema_migrations (name) VALUES ('users_manager_role_v1')").run();
    db.exec('COMMIT;');
    db.pragma('foreign_keys = ON');
    recreateUsersTimestampTrigger(db);
    console.log('[DB] users: rol manager habilitado (migración única)');
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (_) {}
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
    console.warn('[DB] migración role manager:', err.message);
    repairDatabaseState(db);
  }
}

function recreateUsersTimestampTrigger(db) {
  db.exec('DROP TRIGGER IF EXISTS update_users_timestamp');
  const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!hasUsers) return;
  db.exec(`
    CREATE TRIGGER update_users_timestamp
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);
}

/** Tablas cuya FK interna sigue apuntando a users_old tras ALTER RENAME (aunque el SQL diga users). */
function getTablesReferencing(db, refTable) {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all();
  const out = [];
  for (const { name } of tables) {
    if (name === refTable || name.endsWith('_bosa_fkfix')) continue;
    try {
      const fks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
      if (fks.some((fk) => fk.table === refTable)) out.push(name);
    } catch (_) {}
  }
  return out;
}

function recreateTablePreservingRows(db, tableName) {
  const meta = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
  if (!meta?.sql) return false;

  const indexes = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL
  `).all(tableName);

  let createSql = meta.sql.replace(/REFERENCES\s+["']?users_old["']?\s*\(/gi, 'REFERENCES users(');
  const tmp = `${tableName}_bosa_fkfix`;
  const createTmp = createSql.replace(
    new RegExp(`CREATE TABLE\\s+["']?${tableName}["']?`, 'i'),
    `CREATE TABLE "${tmp}"`
  );

  const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all().map((c) => `"${c.name}"`);
  if (!cols.length) return false;

  db.exec(`DROP TABLE IF EXISTS "${tmp}"`);
  db.exec(createTmp);
  db.exec(`INSERT INTO "${tmp}" (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM "${tableName}"`);
  db.exec(`DROP TABLE "${tableName}"`);
  db.exec(`ALTER TABLE "${tmp}" RENAME TO "${tableName}"`);

  for (const idx of indexes) {
    try {
      if (idx.sql) db.exec(idx.sql);
    } catch (err) {
      console.warn(`[DB] índice en ${tableName}:`, err.message);
    }
  }
  return true;
}

/** Reapunta FK de meetings, tickets, etc. a la tabla users actual (no users_old). */
function repairBrokenUserForeignKeys(db) {
  const wasOn = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');

  const broken = getTablesReferencing(db, 'users_old');
  let fixed = 0;
  for (const tableName of broken) {
    try {
      if (recreateTablePreservingRows(db, tableName)) {
        fixed += 1;
        console.log('[DB] FK reparada:', tableName, '→ users');
      }
    } catch (err) {
      console.warn('[DB] repairBrokenUserForeignKeys', tableName, ':', err.message);
    }
  }

  db.pragma(`foreign_keys = ${wasOn ? 'ON' : 'OFF'}`);
  return fixed > 0;
}

/** Repara migración a medias (users_old huérfana / triggers que apuntan a users_old). */
function repairDatabaseState(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    const usersOldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'").get();

    repairBrokenUserForeignKeys(db);

    if (usersOldTable && usersTable) {
      const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const oldCount = db.prepare('SELECT COUNT(*) AS c FROM users_old').get().c;
      if (userCount === 0 && oldCount > 0) {
        db.exec('DROP TABLE users');
        db.exec('ALTER TABLE users_old RENAME TO users');
        console.log('[DB] Reparación: datos recuperados desde users_old');
      } else {
        repairBrokenUserForeignKeys(db);
        db.exec('DROP TABLE IF EXISTS users_old');
        console.log('[DB] Reparación: users_old eliminada');
      }
    } else if (usersOldTable && !usersTable) {
      db.exec('ALTER TABLE users_old RENAME TO users');
      console.log('[DB] Reparación: users_old renombrada a users');
    }

    const badTriggers = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger'
        AND (sql LIKE '%users_old%' OR tbl_name = 'users_old')
    `).all();
    for (const row of badTriggers) {
      db.exec(`DROP TRIGGER IF EXISTS "${row.name}"`);
      console.log('[DB] Reparación: trigger eliminado', row.name);
    }

    recreateUsersTimestampTrigger(db);
  } catch (err) {
    console.warn('[DB] repairDatabaseState:', err.message);
  }
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
