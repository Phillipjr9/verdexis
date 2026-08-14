-- Enable Row Level Security on the tables that hold user-owned data.
-- This file is intended for Postgres/Render deployments.
-- Before applying, ensure your app sets session variables like:
--   SET app.current_user_id = '<user-id>';
--   SET app.current_user_role = 'user';
--   SET app.current_user_is_admin = 'false';

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrustedDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSecurityProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DeletedUserArchive" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminAudit" ENABLE ROW LEVEL SECURITY;

-- Helper predicates
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_user_role', true), '') = 'admin'
      OR COALESCE(current_setting('app.current_user_role', true), '') = 'super_admin'
      OR COALESCE(current_setting('app.current_user_is_admin', true), 'false') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.current_user_id_value()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_user_id', true), '');
$$;

-- Users: users can only view/update their own profile, admins can read all.
DROP POLICY IF EXISTS "users_self_access" ON public."User";
CREATE POLICY "users_self_access"
ON public."User"
FOR ALL
USING (
  id = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  id = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Notifications: users can only see their own notifications.
DROP POLICY IF EXISTS "notifications_self_access" ON public."Notification";
CREATE POLICY "notifications_self_access"
ON public."Notification"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Trusted device records: user owns their own devices, admins can manage them.
DROP POLICY IF EXISTS "trusted_devices_self_access" ON public."TrustedDevice";
CREATE POLICY "trusted_devices_self_access"
ON public."TrustedDevice"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Security events: users can read their own events.
DROP POLICY IF EXISTS "security_events_self_access" ON public."SecurityEvent";
CREATE POLICY "security_events_self_access"
ON public."SecurityEvent"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Recovery codes: only owner or admin can access.
DROP POLICY IF EXISTS "recovery_codes_self_access" ON public."RecoveryCode";
CREATE POLICY "recovery_codes_self_access"
ON public."RecoveryCode"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- User sessions: only owner or admin can access.
DROP POLICY IF EXISTS "user_sessions_self_access" ON public."UserSession";
CREATE POLICY "user_sessions_self_access"
ON public."UserSession"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Security profiles: user owns their own profile; admins can review all.
DROP POLICY IF EXISTS "user_security_profiles_self_access" ON public."UserSecurityProfile";
CREATE POLICY "user_security_profiles_self_access"
ON public."UserSecurityProfile"
FOR ALL
USING (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
)
WITH CHECK (
  "userId" = public.current_user_id_value()
  OR public.current_user_is_admin()
);

-- Archived deleted-user records are admin-only for compliance retention.
DROP POLICY IF EXISTS "deleted_user_archive_admin_only" ON public."DeletedUserArchive";
CREATE POLICY "deleted_user_archive_admin_only"
ON public."DeletedUserArchive"
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Admin audit table is admin-only.
DROP POLICY IF EXISTS "admin_audit_admin_only" ON public."AdminAudit";
CREATE POLICY "admin_audit_admin_only"
ON public."AdminAudit"
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Optional: allow the app to set the current identity when preparing a request.
-- Example in Node/Postgres:
--   await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true);`
--   await prisma.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true);`
--   await prisma.$executeRaw`SELECT set_config('app.current_user_is_admin', ${isAdmin ? 'true' : 'false'}, true);`
