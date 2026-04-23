package database

import (
	"log"
	"mantra-backend/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// ConnectPostgres opens the shared *gorm.DB pool. Schema management is
// handled by backend/database/init.sql, which Postgres runs exactly once
// when the data volume is first created. We intentionally do NOT call
// gorm.AutoMigrate here because:
//
//   - init.sql creates unique constraints with Postgres's default naming
//     (e.g. users_email_key). GORM's AutoMigrate expects its own convention
//     (uni_users_email) and tries to DROP CONSTRAINT that doesn't exist,
//     crashing the backend on every boot (error: "constraint does not
//     exist (SQLSTATE 42704)"). See .agent/05-gotchas.md G22.
//   - Having two sources of schema truth (init.sql + AutoMigrate) means
//     every schema change requires keeping both in sync. init.sql alone is
//     simpler to reason about and reproducible across environments.
//
// If init.sql falls behind the Go models (e.g. a new table), add the
// DDL to init.sql with `CREATE TABLE IF NOT EXISTS ...` and re-apply it
// to existing databases manually. Do NOT re-enable AutoMigrate as a
// shortcut.
func ConnectPostgres() {
	dsn := config.C.DatabaseURL
	if dsn == "" {
		log.Println("[DB] DATABASE_URL not set — skipping PostgreSQL connection")
		return
	}

	logLevel := logger.Info
	if config.C.IsProd() {
		logLevel = logger.Warn
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("[DB] Failed to connect to PostgreSQL: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[DB] Failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)

	DB = db
	log.Println("[DB] PostgreSQL connected (schema managed by init.sql)")
}
