package database

import (
	"log"
	"mantra-backend/config"
	"mantra-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

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

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("[DB] Auto-migration failed: %v", err)
	}

	DB = db
	log.Println("[DB] PostgreSQL connected and migrated successfully")
}
