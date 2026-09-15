-- The quiz event trigger runs in the service-role transaction created by
-- server_commit_match. Its SECURITY INVOKER helper must therefore be
-- executable by service_role, while remaining unavailable to API roles.
grant execute on function private.try_uuid(text) to service_role;
