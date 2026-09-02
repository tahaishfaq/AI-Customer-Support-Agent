-- F06: persist reserved admin email so missing env cannot reopen Google signup hole
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "reservedAdminEmail" TEXT;
