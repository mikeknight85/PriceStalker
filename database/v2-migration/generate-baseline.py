#!/usr/bin/env python3
"""
Generate an idempotent baseline migration from a canonical schema dump.

v2's migration chain (001-022) no longer replays: 012 and 020 reference a column
nothing before them creates, and 010 cannot re-run against the schema shipped in
database/init.sql. The dump is the only working bootstrap, and it stamps nothing
into the `migrations` table. See README.md.

This replaces that chain with a single baseline that reaches the same schema from
any starting point, by emitting only idempotent statements:

  CREATE SEQUENCE IF NOT EXISTS      -- sequences
  CREATE TABLE IF NOT EXISTS         -- whole tables (empty DB, or missing table)
  ADD COLUMN IF NOT EXISTS           -- individual columns (partially-present table)
  ALTER COLUMN SET DEFAULT           -- serial defaults, re-appliable
  ADD CONSTRAINT guarded by pg_constraint lookup
  CREATE INDEX IF NOT EXISTS
  CREATE OR REPLACE FUNCTION
  DROP TRIGGER IF EXISTS + CREATE TRIGGER

The ADD COLUMN pass is what makes a partially-migrated database converge: a v1
database has `users` but not `users.locale`, so CREATE TABLE IF NOT EXISTS alone
would silently leave it short.

Usage:
    pg_dump --schema-only --no-owner --no-privileges <db> > canonical-schema.sql
    ./generate-baseline.py canonical-schema.sql <seeds.sql> > 001_baseline.ts
"""
import re
import sys


def split_statements(sql: str):
    """Split on semicolons at end-of-line, respecting $$-quoted function bodies."""
    out, buf, in_dollar = [], [], False
    for line in sql.split("\n"):
        s = line.strip()
        if not s or s.startswith("--"):
            continue
        if s.startswith("SET ") or s.startswith("SELECT pg_catalog.set_config"):
            continue
        # psql meta-commands (pg_dump 16.13+ emits \restrict / \unrestrict) carry no
        # semicolon, so leaving them in buffers them into the next real statement.
        if s.startswith("\\"):
            continue
        if "$$" in s:
            in_dollar = not in_dollar if s.count("$$") % 2 else in_dollar
        buf.append(line)
        if s.endswith(";") and not in_dollar:
            out.append("\n".join(buf).strip())
            buf = []
    if buf:
        out.append("\n".join(buf).strip())
    return out


def parse_columns(create_table: str):
    """Extract (name, definition) for each column of a CREATE TABLE body."""
    body = create_table[create_table.index("(") + 1: create_table.rindex(")")]
    cols, depth, cur = [], 0, []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            cols.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    if cur:
        cols.append("".join(cur).strip())

    out = []
    for c in cols:
        c = c.strip()
        # skip table-level constraints; we want columns only
        if re.match(r"^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)\b", c, re.I):
            continue
        m = re.match(r'^(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s+(.*)$', c, re.S)
        if m:
            out.append((m.group(1) or m.group(2), m.group(3).strip()))
    return out


def transform(statements):
    tables, columns, seqs, seqs_owned, defaults = [], [], [], [], []
    constraints, indexes, functions, triggers = [], [], [], []

    for st in statements:
        s = st.rstrip(";").strip()
        head = s[:200].upper()

        if head.startswith("CREATE TABLE"):
            m = re.match(r"CREATE TABLE\s+(\S+)\s*\(", s, re.S)
            table = m.group(1)
            tables.append(s.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1) + ";")
            for name, ddl in parse_columns(s):
                # strip NOT NULL: adding a NOT NULL column to a populated table fails.
                # PK/unique constraints are re-applied separately below.
                ddl_safe = re.sub(r"\s*NOT NULL", "", ddl, flags=re.I).strip()
                columns.append(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {ddl_safe};"
                )

        elif head.startswith("CREATE SEQUENCE"):
            seqs.append(s.replace("CREATE SEQUENCE", "CREATE SEQUENCE IF NOT EXISTS", 1) + ";")

        elif head.startswith("ALTER SEQUENCE"):
            # "ALTER SEQUENCE ... OWNED BY <table>.<col>" requires the table to
            # already exist, so this must be emitted after the CREATE TABLE pass.
            seqs_owned.append(s + ";")

        elif head.startswith("CREATE INDEX") or head.startswith("CREATE UNIQUE INDEX"):
            if "IF NOT EXISTS" not in head:
                s = re.sub(r"^CREATE (UNIQUE )?INDEX", r"CREATE \1INDEX IF NOT EXISTS", s, count=1)
            indexes.append(s + ";")

        elif head.startswith("CREATE FUNCTION"):
            functions.append(s.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION", 1) + ";")

        elif head.startswith("CREATE TRIGGER"):
            m = re.match(r"CREATE TRIGGER\s+(\S+)\s+.*?\s+ON\s+(\S+)", s, re.S | re.I)
            triggers.append(f"DROP TRIGGER IF EXISTS {m.group(1)} ON {m.group(2)};")
            triggers.append(s + ";")

        elif head.startswith("ALTER TABLE"):
            m = re.search(r"ADD CONSTRAINT\s+(\S+)", s, re.I)
            if m:
                # guard on constraint name so re-running is a no-op
                constraints.append(
                    "DO $$ BEGIN\n"
                    f"  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{m.group(1)}') THEN\n"
                    f"    {s};\n"
                    "  END IF;\n"
                    "END $$;"
                )
            elif re.search(r"ALTER COLUMN .* SET DEFAULT", s, re.I):
                defaults.append(s + ";")  # naturally idempotent

    return tables, columns, seqs, seqs_owned, defaults, constraints, indexes, functions, triggers


TS_TEMPLATE = '''import {{ MigrationContext }} from '../config/migrate';

/**
 * Squashed baseline schema.
 *
 * GENERATED FILE -- do not edit by hand.
 * Regenerate with database/v2-migration/generate-baseline.py.
 *
 * Replaces migrations 001-022, which no longer replay from an empty database:
 * 012 and 020 reference retailer_configs.original_price_selectors, which nothing
 * before them creates, and 010 cannot re-run against the schema in
 * database/init.sql. That dump was the only working bootstrap, and it stamped
 * nothing into the `migrations` table.
 *
 * Every statement here is idempotent, so this converges to the same schema from
 * any starting point: an empty database, a database bootstrapped from init.sql,
 * or a PriceStalker v1 database that has been through 000_v1_compat.
 */
export const up = async ({{ context: pool }}: {{ context: MigrationContext }}) => {{
  const client = await pool.connect();
  try {{
    await client.query('BEGIN');

    // --- sequences ---------------------------------------------------------
    await client.query(`{sequences}`);

    // --- tables ------------------------------------------------------------
    await client.query(`{tables}`);

    // --- columns (converges tables that already existed but were short) -----
    await client.query(`{columns}`);

    // --- sequence ownership (needs the tables to exist) ---------------------
    await client.query(`{sequences_owned}`);

    // --- column defaults ---------------------------------------------------
    await client.query(`{defaults}`);

    // --- constraints -------------------------------------------------------
    await client.query(`{constraints}`);

    // --- indexes -----------------------------------------------------------
    await client.query(`{indexes}`);

    // --- functions and triggers --------------------------------------------
    await client.query(`{functions}`);
    await client.query(`{triggers}`);

    // --- seed data ---------------------------------------------------------
    await client.query(`{seeds}`);

    await client.query('COMMIT');
  }} catch (error) {{
    await client.query('ROLLBACK');
    throw error;
  }} finally {{
    client.release();
  }}
}};

export const down = async ({{ context: pool }}: {{ context: MigrationContext }}) => {{
  // Intentionally a no-op. This is a baseline; tearing it down would drop every
  // table in the database.
}};
'''


def main():
    schema = open(sys.argv[1]).read()
    seeds = open(sys.argv[2]).read().strip() if len(sys.argv) > 2 else ""
    parts = transform(split_statements(schema))
    tables, columns, seqs, seqs_owned, defaults, constraints, indexes, functions, triggers = parts

    def block(xs):
        return "\n" + "\n".join(xs) + "\n" if xs else "\n"

    sys.stdout.write(TS_TEMPLATE.format(
        sequences=block(seqs), sequences_owned=block(seqs_owned),
        tables=block(tables), columns=block(columns),
        defaults=block(defaults), constraints=block(constraints),
        indexes=block(indexes), functions=block(functions),
        triggers=block(triggers), seeds=block([seeds]) if seeds else "\n",
    ))
    print(
        f"// generated: {len(tables)} tables, {len(columns)} columns, {len(seqs)}+{len(seqs_owned)} sequence stmts, "
        f"{len(constraints)} constraints, {len(indexes)} indexes, "
        f"{len(functions)} functions, {len(triggers)} trigger stmts",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
