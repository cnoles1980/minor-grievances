CREATE TABLE IF NOT EXISTS notes (
 id TEXT PRIMARY KEY,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 3 AND 240),
 signature TEXT NOT NULL CHECK(length(signature) BETWEEN 1 AND 40),
 category TEXT NOT NULL CHECK(category IN ('Work','Travel','Home','People','Tech','Food','Misc')),
 color TEXT NOT NULL CHECK(color IN ('yellow','blue','pink','green')),
 votes INTEGER NOT NULL DEFAULT 0 CHECK(votes>=0),
 demo INTEGER NOT NULL DEFAULT 0,
 hidden INTEGER NOT NULL DEFAULT 0,
 created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS endorsements(note_id TEXT REFERENCES notes(id),visitor TEXT,PRIMARY KEY(note_id,visitor));
CREATE TABLE IF NOT EXISTS reports(note_id TEXT REFERENCES notes(id),visitor TEXT,created INTEGER,PRIMARY KEY(note_id,visitor));
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);
CREATE INDEX IF NOT EXISTS notes_recent ON notes(hidden,created,id);
CREATE INDEX IF NOT EXISTS notes_votes ON notes(hidden,votes,created,id);
CREATE INDEX IF NOT EXISTS limits_expiry ON limits(expires);
-- A successful new endorsement increments once, in the same atomic statement.
CREATE TRIGGER IF NOT EXISTS count_endorsement AFTER INSERT ON endorsements BEGIN
 UPDATE notes SET votes=votes+1 WHERE id=NEW.note_id;
END;
