-- Each user may provision at most one AgentMail forwarding inbox.
-- Enforced at the DB level so a race or a retry can never create a second one.
alter table public.inboxes
  add constraint inboxes_user_id_unique unique (user_id);
