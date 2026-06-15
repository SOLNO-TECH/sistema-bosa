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
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      title          TEXT    NOT NULL,
      description    TEXT,
      start_time     TEXT    NOT NULL, -- ISO 8601
      end_time       TEXT    NOT NULL, -- ISO 8601
      created_by     INTEGER NOT NULL,
      attendees      TEXT,              -- JSON array of user IDs
      location_type  TEXT    NOT NULL DEFAULT 'sala_juntas',
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
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT    NOT NULL,
      content             TEXT    NOT NULL,
      category            TEXT    NOT NULL DEFAULT 'general', -- normal, importante, urgente
      is_active           INTEGER NOT NULL DEFAULT 1,
      created_by          INTEGER NOT NULL,
      tipo                TEXT,
      target_forum_id     INTEGER,
      target_user_id      INTEGER,
      target_departments  TEXT    DEFAULT '[]',
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
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
    db.prepare(`ALTER TABLE meetings ADD COLUMN location_type TEXT NOT NULL DEFAULT 'sala_juntas'`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE workgroups ADD COLUMN access_type TEXT DEFAULT 'all'`).run();
    db.prepare(`ALTER TABLE workgroups ADD COLUMN access_list TEXT DEFAULT '[]'`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE workgroups ADD COLUMN extra_allowed_user_ids TEXT DEFAULT '[]'`).run();
  } catch (err) {}

  try {
    db.prepare(`ALTER TABLE workgroup_messages ADD COLUMN edited_at TEXT`).run();
  } catch (err) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS forum_message_reads (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id    INTEGER NOT NULL,
        read_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(message_id, user_id),
        FOREIGN KEY (message_id) REFERENCES workgroup_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_forum_message_reads_message ON forum_message_reads(message_id);
    `);
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
      CREATE TABLE IF NOT EXISTS meeting_rsvps (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id  INTEGER NOT NULL,
        user_id     INTEGER NOT NULL,
        status      TEXT    NOT NULL DEFAULT 'going' CHECK(status IN ('going', 'declined', 'late')),
        comment     TEXT,
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(meeting_id, user_id),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_meeting ON meeting_rsvps(meeting_id);
    `);
  } catch (err) {
    console.warn('[DB] meeting_rsvps migration:', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_tasks (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id     INTEGER,
        department    TEXT    DEFAULT '',
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

  migrateTicketTasksStandaloneOnce(db);
  migrateTaskCollaborationOnce(db);
  migrateTaskCompletionRequestOnce(db);
  migrateCatalogOnce(db);
  migrateMeetingMinutesVoiceOnce(db);
  migrateMeetingMinutesAudioOnce(db);
  migrateMeetingMinutesAudioExpiryOnce(db);
  migrateVoiceLearningOnce(db);
  migrateAvisosTargetingOnce(db);
  migrateMeetingMinutesSynerteamOnce(db);
  migrateMeetingMinutesNextFollowupOnce(db);
  migrateKnowledgeLinksOnce(db);
  migrateKnowledgeLinksCustomizationOnce(db);
  migrateKnowledgeLinksThemeOnce(db);
  migrateKnowledgeLinksMediaOnce(db);
  migrateMeetingsLocationDeptOnce(db);
  migrateMeetingsCreatedAtOnce(db);

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

  const { cleanupOrphanedMeetingMinutes } = require('../utils/purgeUserData');
  cleanupOrphanedMeetingMinutes(db);
}

/** Permite tareas operativas sin ticket (ticket_id nullable + columna department). */
function migrateTicketTasksStandaloneOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'ticket_tasks_standalone_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(ticket_tasks)').all();
    if (!cols.length) {
      db.prepare("INSERT INTO schema_migrations (name) VALUES ('ticket_tasks_standalone_v1')").run();
      return;
    }

    const hasDept = cols.some((c) => c.name === 'department');
    if (!hasDept) {
      db.prepare(`ALTER TABLE ticket_tasks ADD COLUMN department TEXT DEFAULT ''`).run();
    }

    const ticketIdCol = cols.find((c) => c.name === 'ticket_id');
    if (ticketIdCol?.notnull === 1) {
      db.exec(`
        CREATE TABLE ticket_tasks_standalone_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id     INTEGER,
          department    TEXT    DEFAULT '',
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
      `);
      db.exec(`
        INSERT INTO ticket_tasks_standalone_new (
          id, ticket_id, department, title, description, assigned_to, created_by,
          start_date, end_date, status, created_at, updated_at
        )
        SELECT
          tt.id, tt.ticket_id,
          COALESCE(NULLIF(tt.department, ''), t.category, ''),
          tt.title, tt.description, tt.assigned_to, tt.created_by,
          tt.start_date, tt.end_date, tt.status, tt.created_at, tt.updated_at
        FROM ticket_tasks tt
        LEFT JOIN tickets t ON t.id = tt.ticket_id
      `);
      db.exec('DROP TABLE ticket_tasks');
      db.exec('ALTER TABLE ticket_tasks_standalone_new RENAME TO ticket_tasks');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_tasks_ticket ON ticket_tasks(ticket_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_tasks_assignee ON ticket_tasks(assigned_to)');
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('ticket_tasks_standalone_v1')").run();
  } catch (err) {
    console.warn('[DB] ticket_tasks standalone migration:', err.message);
  }
}

/** Comentarios y archivos por tarea operativa (evidencia aparte del ticket). */
function migrateTaskCollaborationOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'task_collaboration_v1'").get();
    if (done) return;

    db.exec(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id    INTEGER NOT NULL,
        user_id    INTEGER NOT NULL,
        content    TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

      CREATE TABLE IF NOT EXISTS task_attachments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     INTEGER NOT NULL,
        filename    TEXT    NOT NULL,
        mimetype    TEXT,
        path        TEXT    NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id)     REFERENCES ticket_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
    `);

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('task_collaboration_v1')").run();
  } catch (err) {
    console.warn('[DB] task_collaboration migration:', err.message);
  }
}

/** Solicitud de revisión cuando el responsable termina su tramo. */
function migrateTaskCompletionRequestOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'task_completion_request_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(ticket_tasks)').all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('completion_requested_at')) {
      db.prepare('ALTER TABLE ticket_tasks ADD COLUMN completion_requested_at TEXT').run();
    }
    if (!names.has('completion_requested_by')) {
      db.prepare('ALTER TABLE ticket_tasks ADD COLUMN completion_requested_by INTEGER').run();
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('task_completion_request_v1')").run();
  } catch (err) {
    console.warn('[DB] task_completion_request migration:', err.message);
  }
}

/** Aprendizaje de comandos de voz por usuario (Saya AI). */
function migrateVoiceLearningOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'voice_learning_v1'").get();
    if (done) return;

    db.exec(`
      CREATE TABLE IF NOT EXISTS voice_phrase_memory (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL,
        phrase_norm    TEXT    NOT NULL,
        intent         TEXT    NOT NULL,
        params_json    TEXT    NOT NULL DEFAULT '{}',
        summary        TEXT    NOT NULL DEFAULT '',
        hit_count      INTEGER NOT NULL DEFAULT 1,
        success_count  INTEGER NOT NULL DEFAULT 1,
        last_used_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, phrase_norm, intent)
      );
      CREATE INDEX IF NOT EXISTS idx_voice_phrase_user ON voice_phrase_memory(user_id, hit_count DESC);

      CREATE TABLE IF NOT EXISTS voice_command_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL,
        transcript     TEXT    NOT NULL,
        intent         TEXT,
        allowed        INTEGER NOT NULL DEFAULT 0,
        executed       INTEGER NOT NULL DEFAULT 0,
        active_module  TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_voice_log_user ON voice_command_log(user_id, created_at DESC);
    `);

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('voice_learning_v1')").run();
    console.log('[DB] Saya: tablas de aprendizaje de voz listas');
  } catch (err) {
    console.warn('[DB] voice_learning migration:', err.message);
  }
}

/** Minutas ligadas a reunión + transcripción de voz (opcional). */
function migrateMeetingMinutesVoiceOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meeting_minutes_voice_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meeting_minutes)').all();
    const names = cols.map((c) => c.name);
    if (!names.includes('meeting_id')) {
      db.prepare(`ALTER TABLE meeting_minutes ADD COLUMN meeting_id INTEGER`).run();
    }
    if (!names.includes('transcript_text')) {
      db.prepare(`ALTER TABLE meeting_minutes ADD COLUMN transcript_text TEXT NOT NULL DEFAULT ''`).run();
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting ON meeting_minutes(meeting_id)');

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meeting_minutes_voice_v1')").run();
    console.log('[DB] meeting_minutes: meeting_id y transcript_text listos');
  } catch (err) {
    console.warn('[DB] meeting_minutes voice migration:', err.message);
  }
}

/** Ruta relativa del audio de la reunión (data/uploads/…). */
function migrateMeetingMinutesAudioOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meeting_minutes_audio_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meeting_minutes)').all();
    const names = cols.map((c) => c.name);
    if (!names.includes('audio_path')) {
      db.prepare(`ALTER TABLE meeting_minutes ADD COLUMN audio_path TEXT`).run();
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meeting_minutes_audio_v1')").run();
    console.log('[DB] meeting_minutes: audio_path listo');
  } catch (err) {
    console.warn('[DB] meeting_minutes audio migration:', err.message);
  }
}

/** Caducidad del audio Saya sin Pro (24 h). */
function migrateMeetingMinutesAudioExpiryOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meeting_minutes_audio_expiry_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meeting_minutes)').all();
    const names = cols.map((c) => c.name);
    if (!names.includes('audio_expires_at')) {
      db.prepare(`ALTER TABLE meeting_minutes ADD COLUMN audio_expires_at TEXT`).run();
    }
    if (!names.includes('audio_permanent')) {
      db.prepare(`ALTER TABLE meeting_minutes ADD COLUMN audio_permanent INTEGER NOT NULL DEFAULT 0`).run();
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meeting_minutes_audio_expiry_v1')").run();
    console.log('[DB] meeting_minutes: audio_expires_at listo');
  } catch (err) {
    console.warn('[DB] meeting_minutes audio expiry migration:', err.message);
  }
}

/** Accesos directos del módulo Knowledge. */
function migrateKnowledgeLinksOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'knowledge_links_v1'").get();
    if (done) return;

    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_links (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        slug         TEXT    NOT NULL UNIQUE,
        title        TEXT    NOT NULL,
        subtitle     TEXT    NOT NULL DEFAULT '',
        href         TEXT,
        available    INTEGER NOT NULL DEFAULT 1,
        coming_soon  INTEGER NOT NULL DEFAULT 0,
        theme        TEXT    NOT NULL DEFAULT 'navy' CHECK(theme IN ('navy', 'gold', 'muted')),
        sort_order   INTEGER NOT NULL DEFAULT 0,
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_by   INTEGER,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_links_sort ON knowledge_links(sort_order, id);
    `);

    const defaults = [
      {
        slug: 'proyectos-synology',
        title: 'Proyectos BOSA',
        subtitle: 'Synology QuickConnect · archivos de proyecto',
        href: 'https://quickconnect.to/PROYECTOSBOSAmx',
        available: 1,
        coming_soon: 0,
        theme: 'navy',
        sort_order: 1,
      },
      {
        slug: 'compartida-synology',
        title: 'Unidad compartida',
        subtitle: 'Synology QuickConnect · carpeta corporativa',
        href: 'https://quickconnect.to/compartidabosamx',
        available: 1,
        coming_soon: 0,
        theme: 'gold',
        sort_order: 2,
      },
      {
        slug: 'manual-bosa-hub',
        title: 'Manual de uso',
        subtitle: 'Video guía BOSA Hub',
        href: null,
        available: 0,
        coming_soon: 1,
        theme: 'muted',
        sort_order: 3,
      },
    ];

    const insert = db.prepare(`
      INSERT INTO knowledge_links (slug, title, subtitle, href, available, coming_soon, theme, sort_order)
      VALUES (@slug, @title, @subtitle, @href, @available, @coming_soon, @theme, @sort_order)
      ON CONFLICT(slug) DO NOTHING
    `);
    for (const item of defaults) insert.run(item);

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_v1')").run();
    console.log('[DB] knowledge_links listo');
  } catch (err) {
    console.warn('[DB] knowledge_links migration:', err.message);
  }
}

/** Iconos y colores personalizables en Knowledge. */
function migrateKnowledgeLinksCustomizationOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'knowledge_links_custom_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(knowledge_links)').all();
    const names = cols.map((c) => c.name);
    const addCol = (sql) => {
      try {
        db.prepare(sql).run();
      } catch (_) { /* ya existe */ }
    };

    if (!names.includes('icon')) addCol(`ALTER TABLE knowledge_links ADD COLUMN icon TEXT NOT NULL DEFAULT 'folder'`);
    if (!names.includes('bg_color')) addCol(`ALTER TABLE knowledge_links ADD COLUMN bg_color TEXT NOT NULL DEFAULT '#071221'`);
    if (!names.includes('bg_color_end')) addCol(`ALTER TABLE knowledge_links ADD COLUMN bg_color_end TEXT NOT NULL DEFAULT '#0a1930'`);
    if (!names.includes('text_color')) addCol(`ALTER TABLE knowledge_links ADD COLUMN text_color TEXT NOT NULL DEFAULT '#f0f4fa'`);
    if (!names.includes('subtext_color')) addCol(`ALTER TABLE knowledge_links ADD COLUMN subtext_color TEXT NOT NULL DEFAULT 'rgba(240,244,250,0.72)'`);
    if (!names.includes('icon_color')) addCol(`ALTER TABLE knowledge_links ADD COLUMN icon_color TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.22)'`);
    if (!names.includes('badge_bg')) addCol(`ALTER TABLE knowledge_links ADD COLUMN badge_bg TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.14)'`);
    if (!names.includes('badge_text')) addCol(`ALTER TABLE knowledge_links ADD COLUMN badge_text TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.85)'`);

    db.prepare(
      `UPDATE knowledge_links SET
        icon = 'folder',
        bg_color = '#071221', bg_color_end = '#0a1930',
        text_color = '#f0f4fa', subtext_color = 'rgba(240,244,250,0.72)',
        icon_color = 'rgba(255,255,255,0.22)',
        badge_bg = 'rgba(255,255,255,0.14)', badge_text = 'rgba(255,255,255,0.85)'
       WHERE slug = 'proyectos-synology'`,
    ).run();
    db.prepare(
      `UPDATE knowledge_links SET
        icon = 'cloud',
        bg_color = '#8a7355', bg_color_end = '#cbac80',
        text_color = '#071221', subtext_color = 'rgba(7,18,33,0.72)',
        icon_color = 'rgba(7,18,33,0.18)',
        badge_bg = 'rgba(7,18,33,0.12)', badge_text = '#071221'
       WHERE slug = 'compartida-synology'`,
    ).run();
    db.prepare(
      `UPDATE knowledge_links SET
        icon = 'video',
        bg_color = '#334155', bg_color_end = '#64748b',
        text_color = '#f8fafc', subtext_color = 'rgba(248,250,252,0.75)',
        icon_color = 'rgba(255,255,255,0.2)',
        badge_bg = 'rgba(255,255,255,0.12)', badge_text = 'rgba(255,255,255,0.9)'
       WHERE slug = 'manual-bosa-hub'`,
    ).run();

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_custom_v1')").run();
    console.log('[DB] knowledge_links: iconos y colores listos');
  } catch (err) {
    console.warn('[DB] knowledge_links customization migration:', err.message);
  }
}

/** Quita CHECK restrictivo de theme (solo navy/gold/muted) para paletas nuevas. */
function migrateKnowledgeLinksThemeOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'knowledge_links_theme_v2'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(knowledge_links)').all();
    if (!cols.length) {
      db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_theme_v2')").run();
      return;
    }

    const themeCol = cols.find((c) => c.name === 'theme');
    const createSql = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_links'",
    ).get()?.sql || '';
    const hasRestrictiveCheck = /CHECK\s*\(\s*theme\s+IN\s*\(\s*'navy'\s*,\s*'gold'\s*,\s*'muted'\s*\)\s*\)/i.test(createSql);

    if (!hasRestrictiveCheck && themeCol) {
      db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_theme_v2')").run();
      return;
    }

    db.exec(`
      CREATE TABLE knowledge_links_theme_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        slug         TEXT    NOT NULL UNIQUE,
        title        TEXT    NOT NULL,
        subtitle     TEXT    NOT NULL DEFAULT '',
        href         TEXT,
        available    INTEGER NOT NULL DEFAULT 1,
        coming_soon  INTEGER NOT NULL DEFAULT 0,
        theme        TEXT    NOT NULL DEFAULT 'navy',
        icon         TEXT    NOT NULL DEFAULT 'folder',
        bg_color     TEXT    NOT NULL DEFAULT '#071221',
        bg_color_end TEXT    NOT NULL DEFAULT '#0a1930',
        text_color   TEXT    NOT NULL DEFAULT '#f0f4fa',
        subtext_color TEXT   NOT NULL DEFAULT 'rgba(240,244,250,0.72)',
        icon_color   TEXT    NOT NULL DEFAULT 'rgba(255,255,255,0.22)',
        badge_bg     TEXT    NOT NULL DEFAULT 'rgba(255,255,255,0.14)',
        badge_text   TEXT    NOT NULL DEFAULT 'rgba(255,255,255,0.85)',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_by   INTEGER,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    db.exec(`
      INSERT INTO knowledge_links_theme_new (
        id, slug, title, subtitle, href, available, coming_soon, theme, icon,
        bg_color, bg_color_end, text_color, subtext_color, icon_color, badge_bg, badge_text,
        sort_order, is_active, created_by, created_at
      )
      SELECT
        id, slug, title, subtitle, href, available, coming_soon, theme,
        COALESCE(icon, 'folder'),
        COALESCE(bg_color, '#071221'),
        COALESCE(bg_color_end, '#0a1930'),
        COALESCE(text_color, '#f0f4fa'),
        COALESCE(subtext_color, 'rgba(240,244,250,0.72)'),
        COALESCE(icon_color, 'rgba(255,255,255,0.22)'),
        COALESCE(badge_bg, 'rgba(255,255,255,0.14)'),
        COALESCE(badge_text, 'rgba(255,255,255,0.85)'),
        sort_order, is_active, created_by, created_at
      FROM knowledge_links
    `);

    db.exec('DROP TABLE knowledge_links');
    db.exec('ALTER TABLE knowledge_links_theme_new RENAME TO knowledge_links');
    db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_links_sort ON knowledge_links(sort_order, id)');

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_theme_v2')").run();
    console.log('[DB] knowledge_links: theme sin restricción CHECK');
  } catch (err) {
    console.warn('[DB] knowledge_links theme migration:', err.message);
  }
}

/** Archivos y multimedia en Knowledge (además de enlaces externos). */
function migrateKnowledgeLinksMediaOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'knowledge_links_media_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(knowledge_links)').all();
    const names = cols.map((c) => c.name);
    const addCol = (sql) => {
      try {
        db.prepare(sql).run();
      } catch (_) { /* ya existe */ }
    };

    if (!names.includes('content_type')) {
      addCol(`ALTER TABLE knowledge_links ADD COLUMN content_type TEXT NOT NULL DEFAULT 'link'`);
    }
    if (!names.includes('media_path')) addCol('ALTER TABLE knowledge_links ADD COLUMN media_path TEXT');
    if (!names.includes('media_filename')) addCol('ALTER TABLE knowledge_links ADD COLUMN media_filename TEXT');
    if (!names.includes('media_mimetype')) addCol('ALTER TABLE knowledge_links ADD COLUMN media_mimetype TEXT');

    db.prepare(
      `UPDATE knowledge_links SET content_type = 'link' WHERE content_type IS NULL OR TRIM(content_type) = ''`,
    ).run();

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('knowledge_links_media_v1')").run();
    console.log('[DB] knowledge_links: multimedia listo');
  } catch (err) {
    console.warn('[DB] knowledge_links media migration:', err.message);
  }
}

/** Modalidad "Otro" y departamento vinculado en reuniones y minutas. */
function migrateMeetingsLocationDeptOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meetings_location_dept_v1'").get();
    if (done) return;

    const meetingCols = db.prepare('PRAGMA table_info(meetings)').all().map((c) => c.name);
    const minuteCols = db.prepare('PRAGMA table_info(meeting_minutes)').all().map((c) => c.name);
    const addMeetingCol = (sql) => {
      try {
        db.prepare(sql).run();
      } catch (_) { /* ya existe */ }
    };

    if (!meetingCols.includes('location_custom')) {
      addMeetingCol('ALTER TABLE meetings ADD COLUMN location_custom TEXT');
    }
    if (!meetingCols.includes('department')) {
      addMeetingCol('ALTER TABLE meetings ADD COLUMN department TEXT');
    }
    if (!minuteCols.includes('department')) {
      try {
        db.prepare('ALTER TABLE meeting_minutes ADD COLUMN department TEXT').run();
      } catch (_) { /* noop */ }
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meetings_location_dept_v1')").run();
    console.log('[DB] meetings: location_custom y department listos');
  } catch (err) {
    console.warn('[DB] meetings location/dept migration:', err.message);
  }
}

/** Marca de tiempo de creación en reuniones (feed de actividad). */
function migrateMeetingsCreatedAtOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meetings_created_at_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meetings)').all().map((c) => c.name);
    if (!cols.includes('created_at')) {
      db.prepare(`ALTER TABLE meetings ADD COLUMN created_at TEXT`).run();
      db.prepare(`UPDATE meetings SET created_at = start_time WHERE created_at IS NULL OR created_at = ''`).run();
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meetings_created_at_v1')").run();
    console.log('[DB] meetings: created_at listo');
  } catch (err) {
    console.warn('[DB] meetings created_at migration:', err.message);
  }
}

/** Catálogo de roles/departamentos + users.role sin CHECK (no altera filas existentes). */
function migrateCatalogOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'catalog_roles_departments_v1'").get();

    db.exec(`
      CREATE TABLE IF NOT EXISTS catalog_roles (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        slug             TEXT    NOT NULL UNIQUE,
        label            TEXT    NOT NULL,
        permission_level TEXT    NOT NULL DEFAULT 'user'
          CHECK(permission_level IN ('superadmin', 'administrator', 'manager', 'user')),
        is_system        INTEGER NOT NULL DEFAULT 0,
        is_active        INTEGER NOT NULL DEFAULT 1,
        sort_order       INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS catalog_departments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,
        is_active  INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const { seedCatalogIfEmpty } = require('../controllers/catalogController');
    seedCatalogIfEmpty(db);

    migrateUsersRoleWithoutCheckOnce(db);

    if (!done) {
      db.prepare("INSERT INTO schema_migrations (name) VALUES ('catalog_roles_departments_v1')").run();
      console.log('[DB] Catálogo roles/departamentos listo');
    }
  } catch (err) {
    console.warn('[DB] catalog migration:', err.message);
  }
}

/** Quita CHECK en users.role para permitir slugs del catálogo (copia datos tal cual). */
function migrateUsersRoleWithoutCheckOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'users_role_text_v1'").get();
    if (done) return;

    const meta = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (!meta?.sql) {
      db.prepare("INSERT OR IGNORE INTO schema_migrations (name) VALUES ('users_role_text_v1')").run();
      return;
    }
    const sql = meta.sql;
    if (!sql.includes('CHECK') || !sql.includes('role')) {
      db.prepare("INSERT OR IGNORE INTO schema_migrations (name) VALUES ('users_role_text_v1')").run();
      return;
    }

    const cols = db.prepare('PRAGMA table_info(users)').all();
    const colNames = cols.map((c) => c.name);
    const has = (n) => colNames.includes(n);

    db.exec(`
      CREATE TABLE users_role_text_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        role        TEXT    NOT NULL,
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        apellido    TEXT    DEFAULT '',
        telefono    TEXT    DEFAULT '',
        departamento TEXT   DEFAULT '',
        puesto      TEXT    DEFAULT '',
        avatar_url  TEXT    DEFAULT ''
      );
    `);

    const selectCols = [
      'id', 'name', 'email', 'password', 'role', 'is_active', 'created_at', 'updated_at',
      has('apellido') ? 'apellido' : "'' AS apellido",
      has('telefono') ? 'telefono' : "'' AS telefono",
      has('departamento') ? 'departamento' : "'' AS departamento",
      has('puesto') ? 'puesto' : "'' AS puesto",
      has('avatar_url') ? 'avatar_url' : "'' AS avatar_url",
    ];

    db.exec(`
      INSERT INTO users_role_text_new (
        id, name, email, password, role, is_active, created_at, updated_at,
        apellido, telefono, departamento, puesto, avatar_url
      )
      SELECT ${selectCols.join(', ')} FROM users;
    `);

    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_role_text_new RENAME TO users');

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('users_role_text_v1')").run();
    console.log('[DB] users.role sin CHECK (catálogo dinámico)');
  } catch (err) {
    console.warn('[DB] users_role_text migration:', err.message);
  }
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

/** Campos Synerteam en minutas (tema principal, desarrollo, acuerdos, próxima reunión). */
function migrateMeetingMinutesSynerteamOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meeting_minutes_synerteam_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meeting_minutes)').all().map((c) => c.name);
    const add = (name, sql) => {
      if (!cols.includes(name)) db.prepare(sql).run();
    };
    add('tema_principal_json', `ALTER TABLE meeting_minutes ADD COLUMN tema_principal_json TEXT NOT NULL DEFAULT '[]'`);
    add('desarrollo_json', `ALTER TABLE meeting_minutes ADD COLUMN desarrollo_json TEXT NOT NULL DEFAULT '[]'`);
    add('acuerdos_json', `ALTER TABLE meeting_minutes ADD COLUMN acuerdos_json TEXT NOT NULL DEFAULT '[]'`);
    add('next_meeting_fecha', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_fecha TEXT DEFAULT ''`);
    add('next_meeting_hora', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_hora TEXT DEFAULT ''`);
    add('next_meeting_lugar', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_lugar TEXT DEFAULT ''`);

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meeting_minutes_synerteam_v1')").run();
    console.log('[DB] meeting_minutes: campos Synerteam listos');
  } catch (err) {
    console.warn('[DB] meeting_minutes_synerteam migration:', err.message);
  }
}

/** Próxima reunión: modalidad, hora fin, seguimiento y enlace al calendario. */
function migrateMeetingMinutesNextFollowupOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'meeting_minutes_next_followup_v1'").get();
    if (done) return;

    const cols = db.prepare('PRAGMA table_info(meeting_minutes)').all().map((c) => c.name);
    const add = (name, sql) => {
      if (!cols.includes(name)) db.prepare(sql).run();
    };
    add('next_meeting_planned', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_planned TEXT NOT NULL DEFAULT 'no'`);
    add('next_meeting_location_type', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_location_type TEXT NOT NULL DEFAULT 'sala_juntas'`);
    add('next_meeting_hora_fin', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_hora_fin TEXT DEFAULT ''`);
    add('next_meeting_scheduled_id', `ALTER TABLE meeting_minutes ADD COLUMN next_meeting_scheduled_id INTEGER`);

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('meeting_minutes_next_followup_v1')").run();
    console.log('[DB] meeting_minutes: seguimiento próxima reunión listo');
  } catch (err) {
    console.warn('[DB] meeting_minutes next followup migration:', err.message);
  }
}

/** Columnas de destinatario en avisos (foro, departamento, usuario). */
function migrateAvisosTargetingOnce(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const done = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'avisos_targeting_v1'").get();
    if (done) return;

    const cols = db.prepare(`PRAGMA table_info(avisos)`).all().map((c) => c.name);
    if (!cols.includes('tipo')) {
      db.prepare(`ALTER TABLE avisos ADD COLUMN tipo TEXT`).run();
    }
    if (!cols.includes('target_forum_id')) {
      db.prepare(`ALTER TABLE avisos ADD COLUMN target_forum_id INTEGER`).run();
    }
    if (!cols.includes('target_user_id')) {
      db.prepare(`ALTER TABLE avisos ADD COLUMN target_user_id INTEGER`).run();
    }
    if (!cols.includes('target_departments')) {
      db.prepare(`ALTER TABLE avisos ADD COLUMN target_departments TEXT DEFAULT '[]'`).run();
    }

    db.prepare("INSERT INTO schema_migrations (name) VALUES ('avisos_targeting_v1')").run();
    console.log('[DB] avisos: columnas de destinatario listas');
  } catch (err) {
    console.warn('[DB] avisos_targeting migration:', err.message);
  }
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
