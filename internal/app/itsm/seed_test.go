package itsm

import "testing"

func TestSeedCatalogs_CreatesExpectedRootsAndChildren(t *testing.T) {
	db := newTestDB(t)

	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs: %v", err)
	}

	var count int64
	if err := db.Model(&ServiceCatalog{}).Count(&count).Error; err != nil {
		t.Fatalf("count catalogs: %v", err)
	}
	if count != 24 {
		t.Fatalf("expected 24 catalogs, got %d", count)
	}

	var roots int64
	if err := db.Model(&ServiceCatalog{}).Where("parent_id IS NULL").Count(&roots).Error; err != nil {
		t.Fatalf("count roots: %v", err)
	}
	if roots != 6 {
		t.Fatalf("expected 6 roots, got %d", roots)
	}
}

func TestSeedCatalogs_IsIdempotentByCode(t *testing.T) {
	db := newTestDB(t)

	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs first run: %v", err)
	}
	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs second run: %v", err)
	}

	var count int64
	if err := db.Model(&ServiceCatalog{}).Count(&count).Error; err != nil {
		t.Fatalf("count catalogs: %v", err)
	}
	if count != 24 {
		t.Fatalf("expected 24 catalogs after rerun, got %d", count)
	}
}

func TestSeedCatalogs_RecreatesSoftDeletedCatalog(t *testing.T) {
	db := newTestDB(t)

	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs: %v", err)
	}

	var catalog ServiceCatalog
	if err := db.Where("code = ?", "account-access:provisioning").First(&catalog).Error; err != nil {
		t.Fatalf("find seeded catalog: %v", err)
	}
	originalID := catalog.ID
	if err := db.Delete(&catalog).Error; err != nil {
		t.Fatalf("soft delete catalog: %v", err)
	}

	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs rerun: %v", err)
	}

	var restored ServiceCatalog
	if err := db.Where("code = ?", "account-access:provisioning").First(&restored).Error; err != nil {
		t.Fatalf("find restored catalog: %v", err)
	}
	if restored.ID != originalID {
		t.Fatalf("expected soft-deleted catalog to be restored in place, got original=%d restored=%d", originalID, restored.ID)
	}

	var visibleCount int64
	if err := db.Model(&ServiceCatalog{}).Where("code = ?", "account-access:provisioning").Count(&visibleCount).Error; err != nil {
		t.Fatalf("count restored catalog: %v", err)
	}
	if visibleCount != 1 {
		t.Fatalf("expected restored catalog to be visible once, got %d", visibleCount)
	}
}
