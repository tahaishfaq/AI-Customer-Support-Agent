-- One ADMIN row, and keep email unique (already on User.email).
CREATE UNIQUE INDEX IF NOT EXISTS "User_single_admin_role"
ON "User" (role)
WHERE role = 'ADMIN';
