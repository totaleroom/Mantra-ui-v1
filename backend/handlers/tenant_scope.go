package handlers

import (
	"mantra-backend/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// EffectiveTenantScope returns the client_id filter that MUST be applied
// to every non-SUPER_ADMIN read / write on tenant-owned rows. When the
// caller is SUPER_ADMIN the pointer is nil — meaning "no filter", which
// callers should interpret as "operator traversal allowed".
//
// Handlers should prefer this helper over reading c.Locals("clientID")
// directly because it also enforces the invariant that non-SUPER_ADMIN
// principals MUST carry a concrete clientId (the claim being nil is a
// misconfigured user, not a pass-through).
//
// Example usage (list endpoint):
//
//	scope, err := EffectiveTenantScope(c)
//	if err != nil { return fiber.ErrForbidden }
//	q := database.DB.Model(&models.AIProvider{})
//	if scope != nil { q = q.Where("client_id = ?", *scope) }
func EffectiveTenantScope(c *fiber.Ctx) (*uint, error) {
	role, _ := c.Locals("role").(string)
	if role == string(models.UserRoleSuperAdmin) {
		return nil, nil
	}
	cid, _ := c.Locals("clientID").(*uint)
	if cid == nil || *cid == 0 {
		return nil, fiber.ErrForbidden
	}
	return cid, nil
}

// ScopedDB applies the EffectiveTenantScope to a base GORM query on a
// table whose `client_id` column is directly queryable. Returns the
// query unchanged when the caller is SUPER_ADMIN.
func ScopedDB(c *fiber.Ctx, q *gorm.DB, clientIDColumn string) (*gorm.DB, error) {
	scope, err := EffectiveTenantScope(c)
	if err != nil {
		return nil, err
	}
	if scope == nil {
		return q, nil
	}
	return q.Where(clientIDColumn+" = ?", *scope), nil
}

// ScopedDBWithShared is like ScopedDB, but also surfaces rows whose
// client_id IS NULL (i.e. SUPER_ADMIN-owned "shared" / system-wide
// resources). Tenants can READ these rows but the mutation endpoints
// still use plain ScopedDB so they cannot clobber shared data.
//
// Use this ONLY for resource types where "shared defaults" are part
// of the product (currently: ai_providers with a platform API key).
func ScopedDBWithShared(c *fiber.Ctx, q *gorm.DB, clientIDColumn string) (*gorm.DB, error) {
	scope, err := EffectiveTenantScope(c)
	if err != nil {
		return nil, err
	}
	if scope == nil {
		return q, nil
	}
	return q.Where(clientIDColumn+" = ? OR "+clientIDColumn+" IS NULL", *scope), nil
}

// CanMutateClientResource returns nil when the caller may modify a row
// owned by `rowClientID`, or fiber.ErrNotFound otherwise. Mirrors the
// "hide the row entirely" response pattern used elsewhere so tenants
// can't enumerate the existence of sibling tenants' data.
//
// Rules:
//   - SUPER_ADMIN: always allowed.
//   - Tenant principal: only if rowClientID != nil AND *rowClientID matches.
//   - Shared rows (rowClientID == nil) are READ-ONLY for tenants.
func CanMutateClientResource(c *fiber.Ctx, rowClientID *uint) error {
	scope, err := EffectiveTenantScope(c)
	if err != nil {
		return err
	}
	if scope == nil {
		return nil // SUPER_ADMIN
	}
	if rowClientID == nil || *rowClientID != *scope {
		return fiber.ErrNotFound
	}
	return nil
}
