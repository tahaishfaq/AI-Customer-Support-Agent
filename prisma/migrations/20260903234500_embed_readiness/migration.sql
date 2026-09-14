-- Live embed ping + last integration probe snapshot (no secrets).
ALTER TABLE "Agent" ADD COLUMN "embedLastPingAt" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN "embedReadiness" JSONB;
