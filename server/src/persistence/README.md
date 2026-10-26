# Persistence boundary

TAG ships with guest profiles stored in the browser. The server intentionally keeps
match data in memory so an operator can run a zero-configuration LAN session.

If accounts or server-side match history are added, place all database access behind
modules in this directory. Do not import persistence code from match rules or the
Socket.IO gateway. Use PostgreSQL or SQLite, hash passwords with Argon2id or scrypt,
and keep connection strings in server-only environment variables.
