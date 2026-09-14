-- New agents: HTTP / live actions stay off until the owner turns them on.
ALTER TABLE "Agent" ALTER COLUMN "actionsEnabled" SET DEFAULT false;
