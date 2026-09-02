-- F11 Phase C — agent-wide actions kill switch
ALTER TABLE "Agent" ADD COLUMN "actionsEnabled" BOOLEAN NOT NULL DEFAULT true;
