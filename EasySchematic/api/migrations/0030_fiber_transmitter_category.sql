-- Move standalone fiber transmitters out of "Expansion Cards" (wrong for non-frame-card units).
-- Aligns with DEVICE_TYPE_TO_CATEGORY in src/deviceTypeCategories.ts.
UPDATE templates SET category = 'KVM / Extenders' WHERE device_type = 'fiber-transmitter';
